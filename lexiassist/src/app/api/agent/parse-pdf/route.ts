// src/app/api/agent/parse-pdf/route.ts
import { NextResponse } from 'next/server';
import { Receiver, Client } from '@upstash/qstash';
import { extractText, getDocumentProxy } from 'unpdf';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { prisma } from '@/lib/prisma'; // Using your established DB singleton
import { getBaseUrl } from '@/lib/tools/actions/getBaseurl';

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

const qstashClient = new Client({ token: process.env.QSTASH_TOKEN! });

const ParsePdfPayloadSchema = z.object({
  sessionId: z.string().uuid(),
  clientId: z.string().uuid(),
  currentStep: z.number().int(),
  metadata: z.record(z.string(),z.any()),
  messages: z.array(z.any()), 
});

const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15MB
const MAX_EXTRACTED_CHARS = 100_000; 

export const maxDuration = 60;

export async function POST(req: Request) {
  let activeSessionId = '';

  try {
    const signature = req.headers.get('upstash-signature');
    const rawBody = await req.text();
    const isValid = await receiver.verify({ signature: signature || '', body: rawBody }).catch(() => false);
    if (!isValid) return new Response('Unauthorized Webhook Signature', { status: 401 });

    const payload = JSON.parse(rawBody);
    const parsed = ParsePdfPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid parse-pdf payload', details: parsed.error.format() }, { status: 400 });
    }

    const { sessionId, clientId, currentStep, metadata, messages } = parsed.data;
    activeSessionId = sessionId;

    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === 'user');
    const urlMatch = lastUserMessage?.content?.match(/\[Attached File URL: (.+?)\]/);
    const fileUrl = urlMatch?.[1];

    if (!fileUrl) {
      throw new Error('No file URL found in message history — parse-pdf was dispatched without an attachment.');
    }

    // SECURITY: Validate both legacy and modern UploadThing domains
    const allowedHosts = ['utfs.io', '.ufs.sh'];
    const parsedUrl = new URL(fileUrl);
    const isTrustedHost = allowedHosts.some(host => 
      parsedUrl.hostname === host || parsedUrl.hostname.endsWith(host)
    );

    if (!isTrustedHost) {
      throw new Error(`Rejected file URL from untrusted host: ${parsedUrl.hostname}`);
    }

    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) throw new Error(`Failed to fetch PDF from storage: ${fileRes.status}`);

    const contentLength = Number(fileRes.headers.get('content-length') ?? 0);
    if (contentLength > MAX_PDF_BYTES) {
      throw new Error(`PDF exceeds size limit (${contentLength} bytes > ${MAX_PDF_BYTES}).`);
    }

    const arrayBuffer = await fileRes.arrayBuffer();

    // 6. Try native text-layer extraction first
    let extractedText = '';
    let extractionMethod: 'text-layer' | 'vision-ocr' = 'text-layer';

    try {
      const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
      const { text } = await extractText(pdf, { mergePages: true });
      extractedText = text.replace(/\s+/g, ' ').trim(); // Normalize whitespace
    } catch {
      extractedText = ''; 
    }

    // 7. Vision OCR Fallback
    if (extractedText.length < 50) {
      console.log(`[PARSE-PDF] Text layer insufficient (${extractedText.length} chars) — falling back to vision OCR.`);
      extractionMethod = 'vision-ocr';

      const base64Pdf = Buffer.from(arrayBuffer).toString('base64');

      const visionResult = await generateText({
        model: google('gemini-2.5-flash'),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'file', data: base64Pdf, mediaType: 'application/pdf' },
              { type: 'text', text: 'Transcribe ALL readable text from this document, in reading order, exactly as it appears. Do not summarize, interpret, or omit anything. If a section is illegible, write [ILLEGIBLE] in its place. Output only the transcribed text, nothing else.' },
            ],
          },
        ],
      });

      extractedText = visionResult.text.replace(/\s+/g, ' ').trim();
    }

    if (!extractedText || extractedText.length < 20) {
      throw new Error('Document contained no extractable text via text-layer parsing or vision OCR — likely blank, corrupted, or entirely illegible.');
    }

  // 8. Truncate defensively
    const truncated = extractedText.length > MAX_EXTRACTED_CHARS;
    const finalText = truncated
      ? extractedText.slice(0, MAX_EXTRACTED_CHARS) + '\n\n[TRUNCATED — document exceeded processing limit]'
      : extractedText;

    // --- NEW LOGIC: Eager Document Creation ---
    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId },
      select: { caseBriefId: true },
    });

    if (!session) {
      throw new Error(`AgentSession ${sessionId} not found during PDF processing.`);
    }

    if (!session.caseBriefId) {
      throw new Error(`AgentSession ${sessionId} has no caseBriefId — strict eager case creation failed upstream.`);
    }

    // Persist the Document row pointing to the guaranteed CaseBrief
    const doc = await prisma.document.create({
      data: {
        caseBriefId: session.caseBriefId,
        fileUrl,
        extractedText: finalText,
      },
    });
    
    const documentId = doc.id;
    // ------------------------------------------

    // 9. Inject as a new message with the dynamic documentId explicitly mapped
    const documentMessage = {
      role: 'user',
      content: `[DOCUMENT CONTENT extracted from uploaded PDF via ${extractionMethod === 'vision-ocr' ? 'AI vision transcription (scanned document — may contain transcription errors)' : 'native text layer'}, documentId: ${documentId}:]\n\n${finalText}`,
    };

    const updatedMessages = [...messages, documentMessage];

    await prisma.agentSession.update({
      where: { id: sessionId },
      data: { messages: updatedMessages },
    });

    const currentAppUrl = getBaseUrl(req);
    await qstashClient.publishJSON({
      url: `${currentAppUrl}/api/agent/loop`,
      body: { sessionId, clientId, messages: updatedMessages, currentStep, metadata },
      retries: 3,
    });

    console.log(`[PARSE-PDF] Extracted ${finalText.length} chars via ${extractionMethod} for session ${sessionId}. Dispatched to loop.`);
    return new Response('PDF parsed, transitioning to orchestration loop', { status: 200 });

  } catch (error: any) {
    console.error('[PARSE-PDF ERROR]:', error);

    if (activeSessionId) {
      await prisma.agentSession.update({
        where: { id: activeSessionId },
        data: { status: 'FAILED', content: `Document processing failed: ${error.message}` },
      }).catch((e) => console.error('[PARSE-PDF] Failed to write failure status:', e));
    }

    return NextResponse.json({ error: error?.message ?? 'PDF parsing failed' }, { status: 500 });
  }
}