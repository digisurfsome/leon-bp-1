import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { db } from "./db";
import {
  chatMessages,
  chatSessions,
  sessionSummaries,
  batonEvents,
} from "./schema";
import { eq, and, asc, gte, lte } from "drizzle-orm";
import { getRagClient, type RagMatch } from "./rag-client";

export interface ChatMessage {
  id: number;
  sessionId: number;
  role: string;
  content: string;
  model?: string | null;
  approxTokens?: number | null;
  isArchived: boolean;
  createdAt: Date;
}

export interface SessionSummary {
  id: string;
  sessionId: number;
  projectId?: string | null;
  summaryText: string;
  tokenCount: number;
  coveredMessageFrom: number;
  coveredMessageTo: number;
  createdAt: Date;
}

export interface BatonEvent {
  id: string;
  sessionId: number;
  projectId?: string | null;
  eventType: string;
  atTotalTokens?: number | null;
  summaryId?: string | null;
  createdAt: Date;
}

export interface ContextStats {
  totalMessages: number;
  totalTokensEstimated: number;
  summariesCount: number;
  ragChunksUsed: number;
  lastBatonAtTokens?: number;
}

export interface SessionContext {
  recentMessages: ChatMessage[];
  summaries: SessionSummary[];
  ragMatches: RagMatch[];
  contextStats: ContextStats;
}

/**
 * Estimate tokens from text (rough: 1 token ≈ 4 chars)
 */
export function estimateTokens(text: string | any[]): number {
  if (typeof text === "string") {
    return Math.ceil(text.length / 4);
  }

  // If array of messages
  if (Array.isArray(text)) {
    return text.reduce((sum, msg) => {
      const content = typeof msg === "string" ? msg : msg.content || "";
      return sum + estimateTokens(content);
    }, 0);
  }

  return 0;
}

/**
 * Check if we should create a baton summary
 */
export function shouldCreateBaton(opts: {
  totalTokens: number;
  lastBatonTokens?: number;
  threshold: number;
}): boolean {
  const { totalTokens, lastBatonTokens, threshold } = opts;

  // If no previous baton, check against threshold
  if (lastBatonTokens === undefined) {
    return totalTokens >= threshold;
  }

  // If we've accumulated enough tokens since last baton
  const tokensSinceLastBaton = totalTokens - lastBatonTokens;
  return tokensSinceLastBaton >= threshold;
}

/**
 * Create a baton summary for a range of messages
 */
export async function createBatonSummary(opts: {
  sessionId: number;
  projectId?: string;
  messages: ChatMessage[];
  fromIndex: number;
  toIndex: number;
}): Promise<{ summaryId: string; tokenCount: number }> {
  const { sessionId, projectId, messages, fromIndex, toIndex } = opts;

  // Select messages to summarize
  const messagesToSummarize = messages.slice(fromIndex, toIndex + 1);

  if (messagesToSummarize.length === 0) {
    throw new Error("No messages to summarize");
  }

  // Build conversation text
  const conversationText = messagesToSummarize
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");

  // Create summary prompt
  const summaryPrompt = `You are creating a compact memory snapshot of a conversation for long-term context management.

Summarize the following conversation segment into a concise, factual memory that captures:
- Key decisions made and rationale
- Plans, goals, and milestones
- Important constraints, requirements, or preferences
- Open TODOs or action items
- Critical technical context or domain knowledge
- Relationships between concepts discussed

Focus on actionable and contextual information. Omit casual pleasantries and chit-chat.
Use bullet points for clarity. Be concise but preserve important details.

Conversation to summarize:
${conversationText}

Provide a structured summary (max 800 words):`;

  // Use model to generate summary
  const summaryModel = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const summaryResult = await streamText({
    model: openai(summaryModel),
    messages: [{ role: "user", content: summaryPrompt }],
  });

  // Collect summary text
  let summaryText = "";
  for await (const chunk of summaryResult.textStream) {
    summaryText += chunk;
  }

  // Calculate token count
  const tokenCount = messagesToSummarize.reduce(
    (sum, m) => sum + (m.approxTokens || 0),
    0
  );

  // Get message IDs for coverage range
  const coveredMessageFrom = messagesToSummarize[0].id;
  const coveredMessageTo =
    messagesToSummarize[messagesToSummarize.length - 1].id;

  // Insert summary
  const [summary] = await db
    .insert(sessionSummaries)
    .values({
      sessionId,
      projectId: projectId || null,
      summaryText,
      tokenCount,
      coveredMessageFrom,
      coveredMessageTo,
    })
    .returning();

  // Create baton event
  await db.insert(batonEvents).values({
    sessionId,
    projectId: projectId || null,
    eventType: "summary_created",
    atTotalTokens: tokenCount,
    summaryId: summary.id,
  });

  // Mark messages as archived
  const messageIds = messagesToSummarize.map((m) => m.id);
  for (const id of messageIds) {
    await db
      .update(chatMessages)
      .set({ isArchived: true })
      .where(eq(chatMessages.id, id));
  }

  return {
    summaryId: summary.id,
    tokenCount,
  };
}

/**
 * Get complete session context including messages, summaries, and RAG chunks
 */
export async function getSessionContext(opts: {
  userId: string;
  projectId?: string;
  sessionId: number;
  newUserMessage?: string;
  ragTopK?: number;
}): Promise<SessionContext> {
  const {
    userId,
    projectId,
    sessionId,
    newUserMessage,
    ragTopK = 5,
  } = opts;

  // Fetch all messages (archived and unarchived)
  const allMessages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.createdAt));

  // Fetch all session summaries
  const summaries = await db
    .select()
    .from(sessionSummaries)
    .where(eq(sessionSummaries.sessionId, sessionId))
    .orderBy(asc(sessionSummaries.createdAt));

  // Fetch last baton event
  const [lastBaton] = await db
    .select()
    .from(batonEvents)
    .where(
      and(
        eq(batonEvents.sessionId, sessionId),
        eq(batonEvents.eventType, "summary_created")
      )
    )
    .orderBy(asc(batonEvents.createdAt))
    .limit(1);

  // Get RAG matches if we have a query
  let ragMatches: RagMatch[] = [];
  if (newUserMessage && projectId) {
    const ragClient = getRagClient();
    ragMatches = await ragClient.query({
      userId,
      projectId,
      sessionId,
      query: newUserMessage,
      topK: ragTopK,
    });
  }

  // Calculate stats
  const totalMessages = allMessages.length;
  const totalTokensEstimated = allMessages.reduce(
    (sum, m) => sum + (m.approxTokens || 0),
    0
  );
  const summariesCount = summaries.length;
  const ragChunksUsed = ragMatches.length;
  const lastBatonAtTokens = lastBaton?.atTotalTokens || undefined;

  // Return only unarchived messages as "recent"
  const recentMessages = allMessages.filter((m) => !m.isArchived);

  return {
    recentMessages: recentMessages as ChatMessage[],
    summaries: summaries as SessionSummary[],
    ragMatches,
    contextStats: {
      totalMessages,
      totalTokensEstimated,
      summariesCount,
      ragChunksUsed,
      lastBatonAtTokens,
    },
  };
}
