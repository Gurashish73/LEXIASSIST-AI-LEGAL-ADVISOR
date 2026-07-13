// ============================================================================
// ADD THIS FILE TO YOUR REPO AT: src/app/api/agent/sessions/[sessionId]/route.ts
// ============================================================================
//
// WHY: Every test so far has relied on watching the server console because
// init/loop/execute-tool all return 202/200 immediately and do the real work
// async via QStash. That's fine for eyeballing a run, but the PDF-flow tests
// need to actually assert on final state (did extraction succeed, did the
// Document row get created, did redlines get stored) — which means polling.
//
// This is also genuinely useful later for the frontend (the dashboard needs
// exactly this to know when a session is done), so it's not just test scaffolding.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> } // <-- 1. Type as Promise
) {
  const resolvedParams = await params; // <-- 2. Await the params
  const sessionId = resolvedParams.sessionId;

  const session = await prisma.agentSession.findUnique({
    where: { id: sessionId }, // <-- 3. Use the unwrapped ID
    include: {
      caseBrief: {
        include: {
          documents: true,
        },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({
    sessionId: session.id,
    status: session.status,
    content: session.content,
    messageCount: Array.isArray(session.messages) ? (session.messages as any[]).length : 0,
    caseBrief: session.caseBrief
      ? {
          id: session.caseBrief.id,
          title: session.caseBrief.title,
          status: session.caseBrief.status,
          estimatedValue: session.caseBrief.estimatedValue,
          aiRiskAnalysis: session.caseBrief.aiRiskAnalysis,
          aiTimeline: session.caseBrief.aiTimeline,
          aiEntities: session.caseBrief.aiEntities,
          documents: session.caseBrief.documents.map((d) => ({
            id: d.id,
            fileUrl: d.fileUrl,
            extractedTextLength: d.extractedText?.length ?? 0,
            extractedTextPreview: d.extractedText?.slice(0, 200) ?? '',
            redlines: d.redlines,
          })),
        }
      : null,
    updatedAt: session.updatedAt,
  });
}