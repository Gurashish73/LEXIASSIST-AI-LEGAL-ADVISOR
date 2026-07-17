"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { pusher } from "@/lib/pusher/server";

export async function getDirectMessages(caseBriefId: string) {
  try {
    const messages = await prisma.directMessage.findMany({
      where: { caseBriefId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: { id: true, name: true, role: true }
        }
      }
    });
    return { success: true, messages };
  } catch (error) {
    console.error("[DB ERROR] Failed to fetch messages:", error);
    return { success: false, error: "Failed to load chat history." };
  }
}

export async function sendDirectMessage(caseBriefId: string, content: string) {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user || !(session.user as any).id) {
    return { success: false, error: "Unauthorized" };
  }

  const senderId = (session.user as any).id;

  try {
    // 1. Save the message to the database
    const message = await prisma.directMessage.create({
      data: {
        content,
        caseBriefId,
        senderId,
      },
      include: {
        sender: {
          select: { id: true, name: true, role: true }
        }
      }
    });

    // 2. Broadcast the new message to the room instantly
    await pusher.trigger(`chat-${caseBriefId}`, 'new-message', message);

    return { success: true, message };
  } catch (error) {
    console.error("[DB ERROR] Failed to send message:", error);
    return { success: false, error: "Failed to transmit message." };
  }
}