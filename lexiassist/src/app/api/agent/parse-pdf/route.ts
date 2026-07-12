// src/app/api/agent/parse-pdf/route.ts
import { NextResponse } from 'next/server';
import { Receiver, Client } from '@upstash/qstash';
import { extractText, getDocumentProxy } from 'unpdf';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getBaseUrl } from '@/lib/tools/actions/getBaseurl';

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

const qstashClient = new Client({ token: process.env.QSTASH_TOKEN! });

// 1. Strict payload contract — mirrors what init actually sends
const ParsePdfPayloadSchema = z.object({
  sessionId: z.string().uuid(),
  clientId: z.string().uuid(),
  currentStep: z.number().int(),
  metadata: z.record(z.any(),z.any()),
  messages: z.array(z.any()), // full history up to and including the user's message with the file URL
});

const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15MB — tune to your plan's limits
const MAX_EXTRACTED_CHARS = 100_000; // guardrail against dumping a 400-page PDF straight into context

export const maxDuration = 60;

export async function POST(req: Request) {
  let activeSessionId = '';

  try {
    // 2. Signature verification — identical pattern to loop/execute-tool
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

    // 3. Locate the file URL — it's embedded in the last user message by init's
    //    current convention: `${prompt}\n\n[Attached File URL: ${fileUrl}]`
    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === 'user');
    const urlMatch = lastUserMessage?.content?.match(/\[Attached File URL: (.+?)\]/);
    const fileUrl = urlMatch?.[1];

    if (!fileUrl) {
      throw new Error('No file URL found in message history — parse-pdf was dispatched without an attachment.');
    }

    // 4. SECURITY: only fetch from your own UploadThing domain — never
    //    fetch an arbitrary user-supplied URL server-side (SSRF risk)
    const allowedHost = 'utfs.io'; // or your app's UploadThing subdomain, e.g. *.ufs.sh
    const parsedUrl = new URL(fileUrl);
    if (!parsedUrl.hostname.endsWith(allowedHost)) {
      throw new Error(`Rejected file URL from untrusted host: ${parsedUrl.hostname}`);
    }

    // 5. Fetch the file with a size cap enforced via streaming, not after-the-fact
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) {
      throw new Error(`Failed to fetch PDF from storage: ${fileRes.status}`);
    }

    const contentLength = Number(fileRes.headers.get('content-length') ?? 0);
    if (contentLength > MAX_PDF_BYTES) {
      throw new Error(`PDF exceeds size limit (${contentLength} bytes > ${MAX_PDF_BYTES}).`);
    }

    const arrayBuffer = await fileRes.arrayBuffer();

    // 6. Extract text
    let extractedText: string;
    try {
      const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
      const { text } = await extractText(pdf, { mergePages: true });
      extractedText = text.trim();
    } catch (extractionError: any) {
      // Common cause: scanned/image-only PDF with no embedded text layer.
      // This is a distinct, expected failure mode — not a system crash.
      throw new Error(
        `PDF text extraction failed — likely a scanned/image-only document with no text layer. (${extractionError.message})`
      );
    }

    if (!extractedText || extractedText.length < 20) {
      throw new Error('PDF contained no meaningfully extractable text (possibly scanned or empty).');
    }

    // 7. Truncate defensively — never let one document blow the context budget
    const truncated = extractedText.length > MAX_EXTRACTED_CHARS;
    const finalText = truncated
      ? extractedText.slice(0, MAX_EXTRACTED_CHARS) + '\n\n[TRUNCATED — document exceeded processing limit]'
      : extractedText;

    // 8. Inject as a new message, clearly demarcated so the model treats it
    //    as document content, not conversational narrative
    const documentMessage = {
      role: 'user',
      content: `[DOCUMENT CONTENT extracted from uploaded PDF — treat as source material, not client narrative:]\n\n${finalText}`,
    };

    const updatedMessages = [...messages, documentMessage];

    // 9. Persist before dispatching forward — same "DB write before network
    //    hop" discipline as the rest of the pipeline
    await prisma.agentSession.update({
      where: { id: sessionId },
      data: { messages: updatedMessages },
    });

    // 10. Hand off to the normal orchestration loop — from here it's
    //     indistinguishable from a text-only session
    const currentAppUrl = getBaseUrl(req);
    await qstashClient.publishJSON({
      url: `${currentAppUrl}/api/agent/loop`,
      body: { sessionId, clientId, messages: updatedMessages, currentStep, metadata },
      retries: 3,
    });

    console.log(`[PARSE-PDF] Extracted ${finalText.length} chars for session ${sessionId}. Dispatched to loop.`);
    return new Response('PDF parsed, transitioning to orchestration loop', { status: 200 });

  } catch (error: any) {
    console.error('[PARSE-PDF ERROR]:', error);

    // Fail the session cleanly rather than leaving it stuck in PROCESSING forever
    if (activeSessionId) {
      await prisma.agentSession.update({
        where: { id: activeSessionId },
        data: { status: 'FAILED', content: `Document processing failed: ${error.message}` },
      }).catch((e) => console.error('[PARSE-PDF] Failed to write failure status:', e));
    }

    return NextResponse.json({ error: error?.message ?? 'PDF parsing failed' }, { status: 500 });
  }
}