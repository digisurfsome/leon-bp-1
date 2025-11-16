import { generateText } from "ai";
import { db } from "@/lib/db";
import {
  chatSessions,
  chatMessages,
  modelPresets,
  personaPresets,
  userSettings
} from "@/lib/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getOpenRouterModel } from "@/lib/openrouter";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// Request body type
interface ChatRequest {
  sessionId: string | null;
  message: string;
  modelKeys?: string[];
  personaKey?: string | null;
}

// Response types
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelKey?: string | null;
  personaKey?: string | null;
  variantGroupId?: string | null;
  latencyMs?: number | null;
  tokensPrompt?: number | null;
  tokensCompletion?: number | null;
  tokensTotal?: number | null;
  createdAt: Date;
}

interface ModelPresetSummary {
  id: string;
  displayName: string;
  provider: string;
  modelId: string;
}

interface ChatResponse {
  sessionId: string;
  userMessage: ChatMessage;
  replies: ChatMessage[];
  modelsUsed: ModelPresetSummary[];
}

export async function POST(req: Request) {
  try {
    // Get authenticated user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body: ChatRequest = await req.json();
    const { sessionId, message, modelKeys = [], personaKey = null } = body;

    // Validate message
    if (!message?.trim()) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    // Get or create session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      // Create new session
      const newSession = await db
        .insert(chatSessions)
        .values({
          id: crypto.randomUUID(),
          userId,
          title: message.slice(0, 50), // Use first 50 chars as title
        })
        .returning();
      currentSessionId = newSession[0].id;
    } else {
      // Verify session belongs to user
      const existingSession = await db
        .select()
        .from(chatSessions)
        .where(
          and(
            eq(chatSessions.id, currentSessionId),
            eq(chatSessions.userId, userId)
          )
        )
        .limit(1);

      if (!existingSession.length) {
        return Response.json({ error: "Session not found" }, { status: 404 });
      }
    }

    // Determine which models to use
    let targetModelKeys = modelKeys;
    if (!targetModelKeys?.length) {
      // Fallback to user's default model
      const settings = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);

      if (settings[0]?.defaultModelKey) {
        targetModelKeys = [settings[0].defaultModelKey];
      } else {
        // If no default, get first active model
        const firstModel = await db
          .select()
          .from(modelPresets)
          .where(eq(modelPresets.isActive, true))
          .limit(1);

        if (!firstModel.length) {
          return Response.json(
            { error: "No active models available" },
            { status: 500 }
          );
        }
        targetModelKeys = [firstModel[0].id];
      }
    }

    // Fetch model details
    const models = await db
      .select()
      .from(modelPresets)
      .where(
        and(
          eq(modelPresets.isActive, true),
          inArray(modelPresets.id, targetModelKeys)
        )
      );

    const modelMap = new Map(models.map((m) => [m.id, m]));
    const validModelKeys = targetModelKeys.filter((key) => modelMap.has(key));

    if (!validModelKeys.length) {
      return Response.json(
        { error: "No valid models found" },
        { status: 400 }
      );
    }

    // Get persona if specified
    let systemPrompt: string | undefined;
    if (personaKey) {
      const persona = await db
        .select()
        .from(personaPresets)
        .where(eq(personaPresets.id, personaKey))
        .limit(1);

      if (persona.length) {
        systemPrompt = persona[0].systemPrompt;
      }
    }

    // Get conversation history for context
    const history = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, currentSessionId))
      .orderBy(chatMessages.createdAt);

    // Build message array for AI
    const conversationMessages: Array<{ role: "user" | "assistant" | "system"; content: string }> = [];

    if (systemPrompt) {
      conversationMessages.push({ role: "system", content: systemPrompt });
    }

    // Add history (deduplicate variants - only include unique user/assistant pairs)
    const seenVariantGroups = new Set<string>();
    for (const msg of history) {
      if (msg.role === "assistant" && msg.variantGroupId) {
        if (seenVariantGroups.has(msg.variantGroupId)) {
          continue; // Skip duplicate variants
        }
        seenVariantGroups.add(msg.variantGroupId);
      }
      conversationMessages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }

    // Add current user message
    conversationMessages.push({ role: "user", content: message });

    // Persist user message
    const variantGroupId = crypto.randomUUID();
    const userMessageRecord = await db
      .insert(chatMessages)
      .values({
        id: crypto.randomUUID(),
        sessionId: currentSessionId,
        role: "user",
        content: message,
        personaKey,
        variantGroupId,
      })
      .returning();

    // Call all models in parallel
    const modelCalls = validModelKeys.map(async (modelKey) => {
      const modelInfo = modelMap.get(modelKey)!;
      const startTime = Date.now();

      try {
        const model = getOpenRouterModel(modelInfo.modelId);
        const result = await generateText({
          model,
          messages: conversationMessages,
        });

        const latencyMs = Date.now() - startTime;

        // Persist assistant message
        const assistantMessage = await db
          .insert(chatMessages)
          .values({
            id: crypto.randomUUID(),
            sessionId: currentSessionId,
            role: "assistant",
            content: result.text,
            modelKey,
            personaKey,
            variantGroupId,
            latencyMs,
            tokensPrompt: result.usage?.inputTokens ?? null,
            tokensCompletion: result.usage?.outputTokens ?? null,
            tokensTotal: result.usage?.totalTokens ?? null,
          })
          .returning();

        return assistantMessage[0];
      } catch (error) {
        console.error(`Error calling model ${modelKey}:`, error);
        // Return error message as assistant response
        const errorMessage = await db
          .insert(chatMessages)
          .values({
            id: crypto.randomUUID(),
            sessionId: currentSessionId,
            role: "assistant",
            content: `Error: Failed to get response from ${modelInfo.displayName}`,
            modelKey,
            personaKey,
            variantGroupId,
            latencyMs: Date.now() - startTime,
          })
          .returning();
        return errorMessage[0];
      }
    });

    const assistantMessages = await Promise.all(modelCalls);

    // Build response
    const modelsUsed: ModelPresetSummary[] = validModelKeys.map((key) => {
      const model = modelMap.get(key)!;
      return {
        id: model.id,
        displayName: model.displayName,
        provider: model.provider,
        modelId: model.modelId,
      };
    });

    const response: ChatResponse = {
      sessionId: currentSessionId,
      userMessage: userMessageRecord[0] as ChatMessage,
      replies: assistantMessages as ChatMessage[],
      modelsUsed,
    };

    return Response.json(response);
  } catch (error) {
    console.error("Error in chat API:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
