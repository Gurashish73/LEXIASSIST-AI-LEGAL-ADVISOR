// src/lib/tools/actions/match-verify-lawyer.ts
import { prisma } from '@/lib/prisma';
import type { MatchVerifyLawyerInput } from '@/lib/schemas/tools/legal-schemas';

export async function executeMatchVerifyLawyer(args: MatchVerifyLawyerInput) {
  
  // Step 1: Resolve the session and validate sequencing
  const session = await prisma.agentSession.findUnique({
    where: { id: args.caseSessionId },
    select: { caseBriefId: true },
  });

  if (!session) {
    throw new Error(`AgentSession ${args.caseSessionId} not found — cannot match lawyer.`);
  }

  if (!session.caseBriefId) {
    throw new Error(`No CaseBrief linked to session ${args.caseSessionId} — run generatePreBriefRisk first.`);
  }

  // Step 2: Query real candidates
  const candidates = await prisma.lawyerProfile.findMany({
    where: {
      jurisdiction: args.jurisdiction,
      specialization: { has: args.legalDomain },
      isAvailable: true,
    },
    include: { user: { select: { name: true, email: true } } },
  });

  // Step 3: Handle zero-results cleanly (no DB write needed)
  if (candidates.length === 0) {
    return {
      matchFound: false,
      matches: [],
      reason: `No available lawyers found for jurisdiction "${args.jurisdiction}" and domain "${args.legalDomain}".`,
    };
  }

  // Step 4: Rank by experience and return top 3 for user selection
  const ranked = candidates
    .slice()
    .sort((a, b) => b.experienceYrs - a.experienceYrs)
    .slice(0, 3);

  return {
    matchFound: true,
    matches: ranked.map((lawyer) => ({
      id: lawyer.id,
      name: lawyer.user.name ?? 'Unnamed',
      jurisdiction: lawyer.jurisdiction,
      experienceYrs: lawyer.experienceYrs,
    })),
  };
}