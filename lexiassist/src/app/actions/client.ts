// src/app/actions/client.ts
"use server";

import { prisma } from "@/lib/prisma";

export async function getClientCaseDetails(caseId: string) {
  try {
    const caseBrief = await prisma.caseBrief.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        rawDescription: true,
        // If a lawyer is assigned, fetch their basic info for the client
        lawyer: {
          select: {
            jurisdiction: true,
            experienceYrs: true,
            user: {
              select: { name: true }
            }
          }
        }
      }
    });

    if (!caseBrief) {
      return { success: false, error: "Case matrix not found." };
    }

    return { success: true, caseBrief };
  } catch (error) {
    console.error("Failed to fetch client case details:", error);
    return { success: false, error: "Database mapping failed." };
  }
}