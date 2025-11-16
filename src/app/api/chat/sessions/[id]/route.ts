import { db } from "@/lib/db";
import { chatSessions, chatMessages } from "@/lib/schema";
import { eq, and, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get authenticated user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { id } = await params;

    // Verify session belongs to user
    const chatSession = await db
      .select()
      .from(chatSessions)
      .where(
        and(eq(chatSessions.id, id), eq(chatSessions.userId, userId))
      )
      .limit(1);

    if (!chatSession.length) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    // Fetch all messages for the session
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, id))
      .orderBy(asc(chatMessages.createdAt));

    return Response.json({
      session: chatSession[0],
      messages,
    });
  } catch (error) {
    console.error("Error fetching session:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
