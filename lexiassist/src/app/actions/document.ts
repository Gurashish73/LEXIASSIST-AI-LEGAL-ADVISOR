"use server";

import { prisma } from "@/lib/prisma"; 

export async function saveDocumentRecord(fileUrl: string, caseBriefId: string) {
  try {
    let validCaseBriefId = caseBriefId;

    // Testing fallback: If we pass the dummy ID, find the first real case in the database to link against
    if (validCaseBriefId === "test-case-id") {
      const activeBrief = await prisma.caseBrief.findFirst();
      
      if (activeBrief) {
        validCaseBriefId = activeBrief.id;
      } else {
        return { 
          success: false, 
          error: "Database constraint error: You must start a chat session and create at least one Case Brief before you can attach documents to it!" 
        };
      }
    }

    // Now save with an ID that definitely exists in the parent table
    const newDoc = await prisma.document.create({
      data: {
        fileUrl: fileUrl,
        caseBriefId: validCaseBriefId, 
        extractedText: "Pending extraction...", 
      },
    });

    console.log("Document successfully saved to DB:", newDoc.id);
    return { success: true, document: newDoc };
  } catch (error) {
    console.error("Database Insert Error:", error);
    return { success: false, error: "Failed to save document to database." };
  }
}