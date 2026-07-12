// src/lib/tools/actions/generate-document-redlines.ts
import { prisma } from '@/lib/prisma';
import type { GenerateDocumentRedlinesInput } from '@/lib/schemas/tools/legal-schemas';

type StoredFlaggedClause = {
  originalTextSnippet: string;
  riskSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  suggestedRedline: string;
  rationale: string;
  verified: boolean;
};

export async function executeGenerateDocumentRedlines(args: GenerateDocumentRedlinesInput) {
  // 1. Resolve the actual document — hard failure if it doesn't exist
  const document = await prisma.document.findUnique({
    where: { id: args.documentId },
    select: { extractedText: true, caseBriefId: true },
  });

  if (!document) {
    throw new Error(`Document ${args.documentId} not found — cannot generate redlines against a non-existent document.`);
  }

  // 2. Verify each flagged clause's originalTextSnippet actually appears in
  //    the source document corpus specifically.
  const corpus = document.extractedText.toLowerCase();

  const verifiedClauses: StoredFlaggedClause[] = args.flaggedClauses.map((clause) => {
    const snippet = clause.originalTextSnippet.toLowerCase().trim();
    return {
      originalTextSnippet: clause.originalTextSnippet,
      riskSeverity: clause.riskSeverity,
      suggestedRedline: clause.suggestedRedline,
      rationale: clause.rationale,
      verified: snippet.length > 0 && corpus.includes(snippet),
    };
  });

  const unverifiedCount = verifiedClauses.filter((c) => !c.verified).length;
  if (unverifiedCount > 0) {
    console.warn(`[REDLINES] ${unverifiedCount}/${verifiedClauses.length} flagged clauses failed verification for document ${args.documentId}.`);
  }

  // 3. Store on the Document row, not CaseBrief
  await prisma.document.update({
    where: { id: args.documentId },
    data: { redlines: verifiedClauses as any },
  });

  // 4. Return a compact summary
  return {
    acknowledged: true,
    documentId: args.documentId,
    clausesFlagged: verifiedClauses.length,
    clausesVerified: verifiedClauses.length - unverifiedCount,
    clausesUnverified: unverifiedCount,
    highestSeverity: verifiedClauses.reduce((max, c) => {
      const order = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
      return order[c.riskSeverity] > order[max as keyof typeof order] ? c.riskSeverity : max;
    }, 'LOW' as string),
  };
}