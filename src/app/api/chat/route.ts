import { openai } from "@ai-sdk/openai";
import { streamText, UIMessage, convertToModelMessages } from "ai";
import { webSearch } from "@/lib/web-search";
import { db } from "@/lib/db";
import { chatSessions, chatMessages, chatSessionSummaries } from "@/lib/schema";
import { eq, and, asc, sql, inArray } from "drizzle-orm";

// Context limits from environment with defaults
const SOFT_LIMIT = parseInt(process.env.APPULA_CONTEXT_SOFT_LIMIT || "8000");
const HARD_LIMIT = parseInt(process.env.APPULA_CONTEXT_HARD_LIMIT || "12000");

// Ensure HARD >= SOFT
const CONTEXT_SOFT_LIMIT = Math.min(SOFT_LIMIT, HARD_LIMIT);
const CONTEXT_HARD_LIMIT = Math.max(SOFT_LIMIT, HARD_LIMIT);

interface ContextInfo {
  liveTokenTotal: number;
  softLimit: number;
  hardLimit: number;
  loadRatio: number;
  batonCount: number;
  nextBatonInTokens: number;
  justCreatedBaton: boolean;
}

// Estimate tokens from text (rough: 1 token ≈ 4 chars)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Get or create a chat session
async function getOrCreateSession(
  userId: string,
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
      title: "New Chat",
    })
    .returning();

  return newSession.id;
}

// Create a baton summary for old messages
async function createBatonSummary(
  sessionId: number,
  messagesToSummarize: any[]
): Promise<void> {
  if (messagesToSummarize.length === 0) return;

  // Build summarization prompt
  const conversationText = messagesToSummarize
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");

  const summaryPrompt = `You are creating a compact memory snapshot of a conversation for context management.

Summarize the following conversation segment into a concise, factual memory that captures:
- Key decisions made
- Plans and goals
- Important constraints or preferences
- Open TODOs or action items
- Critical context needed for future turns

Avoid including casual chit-chat. Focus on actionable and contextual information.

Conversation to summarize:
${conversationText}

Provide a compact summary (max 500 words):`;

  // Use OpenRouter to generate summary (using a strong model)
  const summaryModel = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const summaryResult = await streamText({
    model: openai(summaryModel),
    messages: [{ role: "user", content: summaryPrompt }],
  });

  // Collect the summary text from the stream
  let summaryText = "";
  for await (const chunk of summaryResult.textStream) {
    summaryText += chunk;
  }

  const tokenEstimate = messagesToSummarize.reduce(
    (sum, m) => sum + (m.approxTokens || 0),
    0
  );
  const lastMessageId =
    messagesToSummarize[messagesToSummarize.length - 1].id;

  // Insert summary
  await db.insert(chatSessionSummaries).values({
    sessionId,
    summary: summaryText,
    summaryType: "baton",
    tokenEstimate,
    coverageUntilMessageId: lastMessageId,
  });

  // Mark messages as archived
  const messageIds = messagesToSummarize.map((m) => m.id);
  await db
    .update(chatMessages)
    .set({ isArchived: true })
    .where(inArray(chatMessages.id, messageIds));
}

export async function POST(req: Request) {
  const {
    messages,
    useWeb,
    sessionId: providedSessionId,
  }: {
    messages: UIMessage[];
    useWeb?: boolean;
    sessionId?: number;
  } = await req.json();

  const userId = "dev-user"; // Hardcoded for now

  // Get or create session
  const sessionId = await getOrCreateSession(userId, providedSessionId);

  let enhancedMessages = [...messages];
  let justCreatedBaton = false;

  // Handle web search if enabled
  if (useWeb && messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    const query =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : lastMessage.parts?.find((p: any) => p.type === "text")?.text || "";

    if (query) {
      const searchResults = await webSearch(query);

      const searchContext = {
        role: "system" as const,
        content: `You have access to recent web search results for the user's query. Use this information to provide an accurate, up-to-date answer.

Search Results:
${searchResults.summary}

Sources:
${searchResults.sources.map((s, i) => `${i + 1}. ${s.title}\n   URL: ${s.url}\n   ${s.snippet || ""}`).join("\n\n")}

Please cite these sources when relevant in your response.`,
      };

      enhancedMessages = [
        ...messages.slice(0, -1),
        searchContext,
        messages[messages.length - 1],
      ];
    }
  }

  // Save user message to DB
  const lastUserMessage = messages[messages.length - 1];
  const userContent =
    typeof lastUserMessage.content === "string"
      ? lastUserMessage.content
      : lastUserMessage.parts?.find((p: any) => p.type === "text")?.text || "";

  const userTokens = estimateTokens(userContent);

  await db.insert(chatMessages).values({
    sessionId,
    role: "user",
    content: userContent,
    approxTokens: userTokens,
    isArchived: false,
  });

  // Fetch all unarchived messages
  const unarchivedMessages = await db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.sessionId, sessionId),
        eq(chatMessages.isArchived, false)
      )
    )
    .orderBy(asc(chatMessages.createdAt));

  // Compute live token total
  let liveTokenTotal = unarchivedMessages.reduce(
    (sum, m) => sum + (m.approxTokens || 0),
    0
  );

  // Check if we need to create a baton summary
  if (liveTokenTotal >= CONTEXT_HARD_LIMIT) {
    // Select oldest 60% of messages to summarize
    const targetTokens = Math.floor(liveTokenTotal * 0.6);
    let tokenSum = 0;
    const messagesToSummarize = [];

    for (const msg of unarchivedMessages) {
      if (tokenSum >= targetTokens) break;
      messagesToSummarize.push(msg);
      tokenSum += msg.approxTokens || 0;
    }

    if (messagesToSummarize.length > 0) {
      await createBatonSummary(sessionId, messagesToSummarize);
      justCreatedBaton = true;

      // Recalculate live token total after archiving
      const remainingMessages = unarchivedMessages.filter(
        (m) => !messagesToSummarize.some((archived) => archived.id === m.id)
      );
      liveTokenTotal = remainingMessages.reduce(
        (sum, m) => sum + (m.approxTokens || 0),
        0
      );
    }
  }

  // Fetch all summaries for this session
  const summaries = await db
    .select()
    .from(chatSessionSummaries)
    .where(eq(chatSessionSummaries.sessionId, sessionId))
    .orderBy(asc(chatSessionSummaries.createdAt));

  const batonCount = summaries.length;

  // Build memory context from summaries
  let memoryContext = "";
  if (summaries.length > 0) {
    const summaryTexts = summaries.map((s) => s.summary).join("\n\n---\n\n");
    // Truncate to reasonable length
    const maxMemoryLength = 6000;
    memoryContext =
      summaryTexts.length > maxMemoryLength
        ? summaryTexts.substring(0, maxMemoryLength) + "..."
        : summaryTexts;
  }

  // Fetch fresh unarchived messages after potential baton creation
  const finalUnarchivedMessages = await db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.sessionId, sessionId),
        eq(chatMessages.isArchived, false)
      )
    )
    .orderBy(asc(chatMessages.createdAt));

  // Build final messages for LLM
  const llmMessages: any[] = [];

  // Add memory context if exists
  if (memoryContext) {
    llmMessages.push({
      role: "system",
      content: `Session memory from previous conversation:\n\n${memoryContext}`,
    });
  }

  // Add unarchived messages
  for (const msg of finalUnarchivedMessages) {
    llmMessages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // Calculate context info
  const loadRatio = liveTokenTotal / CONTEXT_HARD_LIMIT;
  const nextBatonInTokens = Math.max(CONTEXT_HARD_LIMIT - liveTokenTotal, 0);

  const contextInfo: ContextInfo = {
    liveTokenTotal,
    softLimit: CONTEXT_SOFT_LIMIT,
    hardLimit: CONTEXT_HARD_LIMIT,
    loadRatio,
    batonCount,
    nextBatonInTokens,
    justCreatedBaton,
  };

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

  // Return streaming response with context info in headers
  const response = (
    result as unknown as { toUIMessageStreamResponse: () => Response }
  ).toUIMessageStreamResponse();

  // Add custom headers with context info
  response.headers.set("X-Session-Id", sessionId.toString());
  response.headers.set("X-Context-Info", JSON.stringify(contextInfo));

  return response;
}
