import { openai } from "@ai-sdk/openai";
import { streamText, UIMessage, convertToModelMessages } from "ai";
import { webSearch } from "@/lib/web-search";
import { db } from "@/lib/db";
import { chatSessions, chatMessages } from "@/lib/schema";
import { eq } from "drizzle-orm";
import {
  getSessionContext,
  createBatonSummary,
  shouldCreateBaton,
  estimateTokens,
  type ContextStats,
} from "@/lib/baton";

// Context limits from environment
const HARD_LIMIT = parseInt(process.env.APPULA_CONTEXT_HARD_LIMIT || "12000");

interface BatonEventInfo {
  summaryId: string;
  coveredRange: [number, number];
}

/**
 * Get or create a chat session
 */
async function getOrCreateSession(
  userId: string,
  projectId?: string,
  sessionId?: number
): Promise<number> {
  if (sessionId) {
    return sessionId;
  }

  // Create new session
  const [newSession] = await db
    .insert(chatSessions)
    .values({
      userId,
      projectId: projectId || null,
      title: "New Chat",
    })
    .returning();

  return newSession.id;
}

export async function POST(req: Request) {
  try {
    const {
      messages,
      useWeb,
      sessionId: providedSessionId,
      projectId,
    }: {
      messages: UIMessage[];
      useWeb?: boolean;
      sessionId?: number;
      projectId?: string;
    } = await req.json();

    const userId = "dev-user"; // Hardcoded for now

    // Get or create session
    const sessionId = await getOrCreateSession(
      userId,
      projectId,
      providedSessionId
    );

    // Extract user message
    const lastUserMessage = messages[messages.length - 1];
    const userContent =
      typeof lastUserMessage.content === "string"
        ? lastUserMessage.content
        : lastUserMessage.parts?.find((p: any) => p.type === "text")?.text ||
          "";

    const userTokens = estimateTokens(userContent);

    // Save user message to DB
    await db.insert(chatMessages).values({
      sessionId,
      role: "user",
      content: userContent,
      approxTokens: userTokens,
      isArchived: false,
    });

    // Get session context (messages, summaries, RAG chunks)
    let context = await getSessionContext({
      userId,
      projectId,
      sessionId,
      newUserMessage: userContent,
      ragTopK: 5,
    });

    let batonEvent: BatonEventInfo | undefined;
    let justCreatedBaton = false;

    // Check if we need to create a baton summary
    const totalTokens = context.recentMessages.reduce(
      (sum, m) => sum + (m.approxTokens || 0),
      0
    );

    if (
      shouldCreateBaton({
        totalTokens,
        lastBatonTokens: context.contextStats.lastBatonAtTokens,
        threshold: HARD_LIMIT,
      })
    ) {
      // Select oldest 60% of messages to summarize
      const targetCount = Math.floor(context.recentMessages.length * 0.6);
      if (targetCount > 0) {
        const { summaryId, tokenCount } = await createBatonSummary({
          sessionId,
          projectId,
          messages: context.recentMessages,
          fromIndex: 0,
          toIndex: targetCount - 1,
        });

        batonEvent = {
          summaryId,
          coveredRange: [0, targetCount - 1],
        };
        justCreatedBaton = true;

        // Refresh context after baton creation
        context = await getSessionContext({
          userId,
          projectId,
          sessionId,
          newUserMessage: userContent,
          ragTopK: 5,
        });
      }
    }

    // Build system prompt with summaries and RAG
    let systemPrompt = "You are a helpful AI assistant.";

    // Add summaries if available
    if (context.summaries.length > 0) {
      const summariesText = context.summaries
        .map((s, i) => `\n${i + 1}. ${s.summaryText}`)
        .join("\n");
      systemPrompt += `\n\n## Session Memory (from previous conversation):\n${summariesText}`;
    }

    // Add RAG matches if available
    if (context.ragMatches.length > 0) {
      const ragText = context.ragMatches
        .map(
          (m, i) =>
            `\n${i + 1}. [Similarity: ${m.similarity.toFixed(2)}] ${m.content}`
        )
        .join("\n");
      systemPrompt += `\n\n## Relevant project knowledge:\n${ragText}`;
    }

    systemPrompt += `\n\nUse this context to provide informed responses, but don't repeat it verbatim unless necessary.`;

    // Handle web search if enabled
    let webSearchContext = "";
    if (useWeb && userContent) {
      const searchResults = await webSearch(userContent);
      webSearchContext = `\n\n## Web Search Results:\n${searchResults.summary}\n\nSources:\n${searchResults.sources.map((s, i) => `${i + 1}. ${s.title}\n   URL: ${s.url}`).join("\n")}`;
      systemPrompt += webSearchContext;
    }

    // Build messages for LLM
    const llmMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...context.recentMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    // Stream response from model
    const result = streamText({
      model: openai(process.env.OPENAI_MODEL || "gpt-4o-mini"),
      messages: convertToModelMessages(llmMessages),
      async onFinish({ text }) {
        // Save assistant message after streaming completes
        const assistantTokens = estimateTokens(text);
        await db.insert(chatMessages).values({
          sessionId,
          role: "assistant",
          content: text,
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          approxTokens: assistantTokens,
          isArchived: false,
        });
      },
    });

    // Prepare context stats for response
    const contextStats: ContextStats = {
      ...context.contextStats,
      totalTokensEstimated:
        context.contextStats.totalTokensEstimated + userTokens,
    };

    // Return streaming response with headers
    const response = (
      result as unknown as { toUIMessageStreamResponse: () => Response }
    ).toUIMessageStreamResponse();

    // Add custom headers
    response.headers.set("X-Session-Id", sessionId.toString());
    response.headers.set("X-Context-Stats", JSON.stringify(contextStats));
    if (batonEvent) {
      response.headers.set("X-Baton-Event", JSON.stringify(batonEvent));
    }
    response.headers.set(
      "X-Just-Created-Baton",
      justCreatedBaton.toString()
    );

    return response;
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({
        error: "An error occurred processing your request",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
