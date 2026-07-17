//src/app/actions/getCaseData.ts
"use server";

import { prisma } from "@/lib/prisma";

// fetcher for Tabs 3 (Redlines) & 4 (Chronology)
export async function getCaseData(caseBriefId: string) {
  try {
    const caseData = await prisma.caseBrief.findUnique({
      where: { id: caseBriefId },
      include: { documents: true },
    });

    if (!caseData) return { success: false, error: "Case not found." };
    return { success: true, data: caseData };
  } catch (error) {
    return { success: false, error: "Failed to fetch case data." };
  }
}