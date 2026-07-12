// src/app/api/agent/init/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { Client } from '@upstash/qstash';
import { z } from 'zod';
import { getBaseUrl } from "@/lib/tools/actions/getBaseurl"

const qstashClient = new Client({ token: process.env.QSTASH_TOKEN! });

// 1. Strict Input Validation Schema
const InitRequestSchema = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty"),
  clientId: z.string().uuid("Invalid Client ID"),
  sessionId: z.string().uuid("Invalid Session ID").optional(), // Pass this to continue a chat
  caseBriefId: z.string().uuid("Invalid Case Brief ID").optional(),
  fileUrl: z.string().url("Invalid File URL").optional(),
  hasPdf: z.boolean().default(false),
  metadata: z.object({
    jurisdiction: z.string().optional(),
    legalDomain: z.string().optional(),
    estimatedBudget: z.number().optional(),
  }).default({}),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 2. Validate Incoming Payload
    const parsedData = InitRequestSchema.safeParse(body);
    if (!parsedData.success) {
      return NextResponse.json(
        { error: 'Invalid payload structure', details: parsedData.error.format() },
        { status: 400 }
      );
    }

    const { prompt, clientId, sessionId: incomingSessionId, fileUrl, hasPdf, metadata } = parsedData.data;

    // 3. Format the new user message
    const newUserMessage = {
      role: 'user',
      content: hasPdf && fileUrl
        ? `${prompt}\n\n[Attached File URL: ${fileUrl}]`
        : prompt,
    };

    let activeSessionId = incomingSessionId;
    let messagesHistory: any[] = [];

    // 4. State Rehydration & DB Operations
    if (activeSessionId) {
      // CONTINUATION: Fetch existing session and append
      const existingSession = await prisma.agentSession.findUnique({
        where: { id: activeSessionId },
      });

      if (!existingSession) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      if (existingSession.status === 'PROCESSING') {
        return NextResponse.json(
          { error: 'Session is currently processing a previous turn. Please wait for a response.' },
          { status: 409 }
        );
      }

      // Parse existing messages (default to empty array if null)
      messagesHistory = existingSession.messages
        ? (existingSession.messages as any[])
        : [];

      messagesHistory.push(newUserMessage);

      // Lock the session back to PROCESSING mode
      await prisma.agentSession.update({
        where: { id: activeSessionId },
        data: {
          status: 'PROCESSING',
          messages: messagesHistory, // Update DB before network dispatch
        }
      });

    } else {
      // NEW SESSION: Create record with the first message
      messagesHistory = [newUserMessage];

      // If caseBriefId was supplied, verify it actually belongs to this client
      // before linking — never trust a client-supplied ID blindly.
      if (parsedData.data.caseBriefId) {
        const brief = await prisma.caseBrief.findUnique({ where: { id: parsedData.data.caseBriefId } });
        if (!brief || brief.clientId !== clientId) {
          return NextResponse.json({ error: 'Case not found or does not belong to this client' }, { status: 404 });
        }
      }

      const newSession = await prisma.agentSession.create({
        data: {
          clientId,
          status: 'PROCESSING',
          messages: messagesHistory,
          metadata: metadata as any,
          caseBriefId: parsedData.data.caseBriefId ?? null
        }
      });
      activeSessionId = newSession.id;
    }

    // 5. Construct Queue Payload for the Hot Network Loop
    const queuePayload = {
      sessionId: activeSessionId,
      clientId,
      currentStep: 0,
      metadata,
      messages: messagesHistory, // Full context passed to Gemini
    };

    // 6. Hardened Dynamic Host Resolution
    const currentAppUrl = getBaseUrl(req);

    // 7. Routing Fork: PDF Pre-Processing vs Standard Loop
    if (hasPdf && fileUrl) {
      console.log(`[INIT] File detected. Dispatching Session ${activeSessionId} to PDF Parser.`);
      await qstashClient.publishJSON({
        url: `${currentAppUrl}/api/agent/parse-pdf`,
        body: queuePayload,
        retries: 3,
      });
    } else {
      console.log(`[INIT] Text-only request. Dispatching Session ${activeSessionId} to Orchestration Loop.`);
      await qstashClient.publishJSON({
        url: `${currentAppUrl}/api/agent/loop`,
        body: queuePayload,
        retries: 3,
      });
    }

    // 8. Asynchronous 202 Release
    return NextResponse.json(
      {
        message: 'Legal intake process accepted and queued.',
        sessionId: activeSessionId
      },
      { status: 202 }
    );

  } catch (error: any) {
    console.error('[INIT_ERROR] Failed to initialize agent sequence:', error);
    return NextResponse.json(
      { error: 'Internal Server Error during intake initialization', details: error?.message },
      { status: 500 }
    );
  }
}