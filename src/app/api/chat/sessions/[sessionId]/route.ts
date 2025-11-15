/**
 * GET /api/chat/sessions/[sessionId]
 * Returns all messages for a specific chat session
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatSessions, chatMessages } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-utils";
import { eq, and, asc } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const user = await getCurrentUser();

    // Verify the session belongs to the user
    const session = await db
      .select()
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.id, sessionId),
          eq(chatSessions.userId, user.id)
        )
      )
      .limit(1);

    if (!session || session.length === 0) {
      return NextResponse.json(
        { error: "Session not found or access denied" },
        { status: 404 }
      );
    }

    // Fetch all messages for the session
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(asc(chatMessages.createdAt));

    return NextResponse.json({
      session: session[0],
      messages,
    });
  } catch (error) {
    console.error("Error fetching session messages:", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch session messages" },
      { status: 500 }
    );
  }
}
