// src/lib/tools/actions/generate-pre-brief-risk.ts
import { prisma } from '@/lib/prisma';
import type { GeneratePreBriefRiskInput } from '@/lib/schemas/tools/legal-schemas';

export async function executeGeneratePreBriefRisk(args: GeneratePreBriefRiskInput) {
  
  // Step 1: Look up the session for relational mapping
  const session = await prisma.agentSession.findUnique({
    where: { id: args.caseSessionId },
    select: { clientId: true, caseBriefId: true },
  });

  if (!session) {
    throw new Error(`AgentSession ${args.caseSessionId} not found — cannot attach risk assessment.`);
  }

  // Step 2: Extract the pre-synthesized summary and prepare the risk payload
  const rawDescription = args.caseSummary;

  const riskPayload = {
    estimatedCaseValue: args.estimatedCaseValue,
    primaryLegalRisks: args.primaryLegalRisks,
    statuteOfLimitationsWarning: args.statuteOfLimitationsWarning,
  };

  let caseBrief;

  // Step 3: Explicit branching to protect the title field from overwrites
  if (session.caseBriefId) {
    caseBrief = await prisma.caseBrief.update({
      where: { id: session.caseBriefId },
      data: {
        rawDescription, // Overwrite with improved multi-turn synthesis
        aiRiskAnalysis: riskPayload,
        estimatedValue: args.estimatedCaseValue,
        status: 'REVIEW',
      },
    });
  } else {
    caseBrief = await prisma.caseBrief.create({
      data: {
        clientId: session.clientId,
        title: rawDescription.slice(0, 80), // Set once, never touch again
        rawDescription,
        aiRiskAnalysis: riskPayload,
        estimatedValue: args.estimatedCaseValue,
        status: 'REVIEW',
      },
    });

    // Link the new case back to the active chat session
    await prisma.agentSession.update({
      where: { id: args.caseSessionId },
      data: { caseBriefId: caseBrief.id },
    });
  }

  // Step 4: Return strict structured data back to the LLM Context
  return {
    acknowledged: true,
    caseBriefId: caseBrief.id,
    status: caseBrief.status,
    riskFlagsCount: args.primaryLegalRisks.length,
    statuteWarningTriggered: args.statuteOfLimitationsWarning,
  };
}