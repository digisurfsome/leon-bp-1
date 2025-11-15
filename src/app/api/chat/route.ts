/**
 * POST /api/chat
 * Main chat endpoint with OpenRouter integration, persistence, and model/persona selection
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  chatSessions,
  chatMessages,
  modelPresets,
  personaPresets,
  userSettings,
} from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-utils";
import { callOpenRouter } from "@/lib/openrouter";
import { getDefaultModelPreset, getDefaultPersonaPreset } from "@/lib/models";
import { eq } from "drizzle-orm";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatRequest {
  sessionId?: string; // Optional: if omitted, create new session
  messages: ChatMessage[]; // Conversation history (usually just the latest user message)
  modelPresetId?: string; // Optional: override user's default
  personaPresetId?: string; // Optional: override user's default
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const body: ChatRequest = await request.json();

    // Validate input
    if (!body.messages || body.messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // Step 1: Get or create chat session
    let sessionId = body.sessionId;

    if (!sessionId) {
      // Create new session
      const newSession = await db
        .insert(chatSessions)
        .values({
          userId: user.id,
          title: null, // Will be auto-generated later or left as "New Chat"
        })
        .returning();

      sessionId = newSession[0].id;
    } else {
      // Verify session belongs to user
      const session = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.id, sessionId))
        .limit(1);

      if (!session || session.length === 0 || session[0].userId !== user.id) {
        return NextResponse.json(
          { error: "Invalid session ID" },
          { status: 404 }
        );
      }

      // Update session's updatedAt timestamp
      await db
        .update(chatSessions)
        .set({ updatedAt: new Date() })
        .where(eq(chatSessions.id, sessionId));
    }

    // Step 2: Resolve model preset
    let modelPreset;

    if (body.modelPresetId) {
      // Use provided model
      const preset = await db
        .select()
        .from(modelPresets)
        .where(eq(modelPresets.id, body.modelPresetId))
        .limit(1);

      if (!preset || preset.length === 0) {
        return NextResponse.json(
          { error: "Invalid model preset ID" },
          { status: 400 }
        );
      }

      modelPreset = preset[0];
    } else {
      // Use user's default or global default
      const settings = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, user.id))
        .limit(1);

      if (settings && settings[0]?.defaultModelPresetId) {
        const preset = await db
          .select()
          .from(modelPresets)
          .where(eq(modelPresets.id, settings[0].defaultModelPresetId))
          .limit(1);

        modelPreset = preset[0];
      }

      // Fallback to default
      if (!modelPreset) {
        const defaultPreset = getDefaultModelPreset();
        const preset = await db
          .select()
          .from(modelPresets)
          .where(eq(modelPresets.slug, defaultPreset.slug))
          .limit(1);

        modelPreset = preset[0];
      }
    }

    if (!modelPreset) {
      return NextResponse.json(
        { error: "No model preset available. Please seed the database." },
        { status: 500 }
      );
    }

    // Step 3: Resolve persona preset
    let personaPreset;

    if (body.personaPresetId) {
      // Use provided persona
      const preset = await db
        .select()
        .from(personaPresets)
        .where(eq(personaPresets.id, body.personaPresetId))
        .limit(1);

      if (!preset || preset.length === 0) {
        return NextResponse.json(
          { error: "Invalid persona preset ID" },
          { status: 400 }
        );
      }

      personaPreset = preset[0];
    } else {
      // Use user's default or global default
      const settings = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, user.id))
        .limit(1);

      if (settings && settings[0]?.defaultPersonaPresetId) {
        const preset = await db
          .select()
          .from(personaPresets)
          .where(eq(personaPresets.id, settings[0].defaultPersonaPresetId))
          .limit(1);

        personaPreset = preset[0];
      }

      // Fallback to default
      if (!personaPreset) {
        const defaultPreset = getDefaultPersonaPreset();
        const preset = await db
          .select()
          .from(personaPresets)
          .where(eq(personaPresets.slug, defaultPreset.slug))
          .limit(1);

        personaPreset = preset[0];
      }
    }

    // Step 4: Build messages array with system prompt
    const messagesToSend: ChatMessage[] = [
      {
        role: "system",
        content: personaPreset?.systemPrompt || "You are a helpful AI assistant.",
      },
      ...body.messages,
    ];

    // Step 5: Call OpenRouter
    const openRouterResponse = await callOpenRouter({
      model: modelPreset.modelName,
      messages: messagesToSend,
      temperature: modelPreset.temperature || 0.7,
      max_tokens: modelPreset.maxOutputTokens || 4096,
    });

    const assistantMessage = openRouterResponse.choices[0]?.message?.content;

    if (!assistantMessage) {
      throw new Error("No response from OpenRouter");
    }

    // Step 6: Persist user messages (only new ones that aren't in DB yet)
    // For simplicity in Phase 1, we'll save the last user message
    const userMessage = body.messages.find((msg) => msg.role === "user");
    if (userMessage) {
      await db.insert(chatMessages).values({
        sessionId,
        role: "user",
        content: userMessage.content,
        modelPresetId: null,
        personaPresetId: personaPreset?.id || null,
      });
    }

    // Step 7: Persist assistant response
    await db.insert(chatMessages).values({
      sessionId,
      role: "assistant",
      content: assistantMessage,
      modelPresetId: modelPreset.id,
      personaPresetId: personaPreset?.id || null,
    });

    // Step 8: Return response
    return NextResponse.json({
      sessionId,
      message: {
        role: "assistant",
        content: assistantMessage,
      },
      modelPresetId: modelPreset.id,
      personaPresetId: personaPreset?.id || null,
      usage: openRouterResponse.usage,
    });
  } catch (error) {
    console.error("Error in chat endpoint:", error);

    if (error instanceof Error) {
      if (error.message.includes("Unauthorized")) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }

      if (error.message.includes("OpenRouter")) {
        return NextResponse.json(
          { error: `LLM Error: ${error.message}` },
          { status: 502 }
        );
      }
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
