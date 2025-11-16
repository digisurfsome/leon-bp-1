import { db } from "@/lib/db";
import { chatSessions, chatMessages } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET() {
  try {
    // Get authenticated user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch user's sessions with message count
    const sessions = await db
      .select({
        id: chatSessions.id,
        userId: chatSessions.userId,
        title: chatSessions.title,
        createdAt: chatSessions.createdAt,
        updatedAt: chatSessions.updatedAt,
      })
      .from(chatSessions)
      .where(eq(chatSessions.userId, userId))
      .orderBy(desc(chatSessions.updatedAt));

    // Get message counts for each session
    const sessionData = await Promise.all(
      sessions.map(async (session) => {
        const messages = await db
          .select()
          .from(chatMessages)
          .where(eq(chatMessages.sessionId, session.id));

        return {
          ...session,
          messageCount: messages.length,
        };
      })
    );

    return Response.json({ sessions: sessionData });
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
