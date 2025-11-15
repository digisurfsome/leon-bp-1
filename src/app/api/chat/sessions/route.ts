/**
 * GET /api/chat/sessions
 * Returns all chat sessions for the current user
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatSessions, chatMessages } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-utils";
import { eq, desc, sql } from "drizzle-orm";

export async function GET() {
  try {
    const user = await getCurrentUser();

    // Fetch all sessions for the user with message count
    const sessions = await db
      .select({
        id: chatSessions.id,
        userId: chatSessions.userId,
        title: chatSessions.title,
        createdAt: chatSessions.createdAt,
        updatedAt: chatSessions.updatedAt,
        messageCount: sql<number>`(
          SELECT COUNT(*)::int
          FROM ${chatMessages}
          WHERE ${chatMessages.sessionId} = ${chatSessions.id}
        )`,
      })
      .from(chatSessions)
      .where(eq(chatSessions.userId, user.id))
      .orderBy(desc(chatSessions.updatedAt));

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Error fetching chat sessions:", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch chat sessions" },
      { status: 500 }
    );
  }
}
