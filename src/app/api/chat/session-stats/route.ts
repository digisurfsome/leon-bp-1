import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionSummaries, batonEvents, ragChunks } from "@/lib/schema";
import { eq, and, count } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionIdStr = searchParams.get("sessionId");
    const projectId = searchParams.get("projectId");

    if (!sessionIdStr) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    const sessionId = parseInt(sessionIdStr);

    // Count summaries for this session
    const [summariesResult] = await db
      .select({ count: count() })
      .from(sessionSummaries)
      .where(eq(sessionSummaries.sessionId, sessionId));

    // Count baton events for this session
    const [batonEventsResult] = await db
      .select({ count: count() })
      .from(batonEvents)
      .where(eq(batonEvents.sessionId, sessionId));

    // Count RAG chunks for this session/project
    let ragChunksCount = 0;
    if (projectId) {
      const [ragChunksResult] = await db
        .select({ count: count() })
        .from(ragChunks)
        .where(
          and(
            eq(ragChunks.projectId, projectId),
            eq(ragChunks.sessionId, sessionId)
          )
        );
      ragChunksCount = ragChunksResult.count;
    }

    // Get last baton event with token info
    const [lastBaton] = await db
      .select()
      .from(batonEvents)
      .where(
        and(
          eq(batonEvents.sessionId, sessionId),
          eq(batonEvents.eventType, "summary_created")
        )
      )
      .orderBy(batonEvents.createdAt)
      .limit(1);

    return NextResponse.json({
      summariesCount: summariesResult.count || 0,
      batonEventsCount: batonEventsResult.count || 0,
      ragChunksCount,
      lastBatonAtTokens: lastBaton?.atTotalTokens || undefined,
    });
  } catch (error) {
    console.error("Session stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch session stats" },
      { status: 500 }
    );
  }
}
