// src/app/api/cases/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const CreateCaseSchema = z.object({
  clientId: z.string().uuid(),
  title: z.string().min(1).max(120),
});

// ============================================================================
// POST /api/cases — Create Case flow
// Called from the "Create Case" tab before any chat/tool activity happens.
// Every AgentSession going forward must reference a caseBriefId that came
// from here (or an existing case picked from GET below) — init no longer
// accepts sessions with no caseBriefId.
// ============================================================================
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = CreateCaseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload structure', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { clientId, title } = parsed.data;

    const caseBrief = await prisma.caseBrief.create({
      data: {
        clientId,
        title,
        rawDescription: '', // populated later by generatePreBriefRisk's first run
        status: 'TRIAGE',
      },
    });

    console.log(`[CASES] Created CaseBrief ${caseBrief.id} for client ${clientId}: "${title}"`);

    return NextResponse.json(
      { caseBriefId: caseBrief.id, title: caseBrief.title, status: caseBrief.status },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('[CASES_ERROR] Failed to create case:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Internal error creating case' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/cases?clientId=... — Case list for the dropdown/dashboard
// Powers "here are your existing cases, pick one" before starting a new
// chat thread against an existing CaseBrief.
// ============================================================================
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');

    const parsed = z.string().uuid().safeParse(clientId);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Missing or invalid clientId query param' }, { status: 400 });
    }

    const cases = await prisma.caseBrief.findMany({
      where: { clientId: parsed.data },
      select: {
        id: true,
        title: true,
        status: true,
        estimatedValue: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { documents: true, agentSessions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ cases }, { status: 200 });

  } catch (error: any) {
    console.error('[CASES_ERROR] Failed to list cases:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Internal error listing cases' },
      { status: 500 }
    );
  }
}