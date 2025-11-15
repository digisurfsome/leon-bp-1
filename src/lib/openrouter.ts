/**
 * OpenRouter API Client
 * Handles communication with OpenRouter for multi-LLM access
 */

export interface OpenRouterMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface OpenRouterRequest {
  model: string; // e.g. "openai/gpt-4.1-mini"
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Call OpenRouter API (non-streaming)
 */
export async function callOpenRouter(
  request: OpenRouterRequest
): Promise<OpenRouterResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
      "X-Title": "Appula Chat",
    },
    body: JSON.stringify({
      ...request,
      stream: false, // Phase 1: no streaming
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenRouter API error (${response.status}): ${errorText}`
    );
  }

  return response.json();
}

/**
 * Stream OpenRouter API response (for future streaming implementation)
 */
export async function streamOpenRouter(
  request: OpenRouterRequest
): Promise<ReadableStream> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
      "X-Title": "Appula Chat",
    },
    body: JSON.stringify({
      ...request,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenRouter API error (${response.status}): ${errorText}`
    );
  }

  if (!response.body) {
    throw new Error("Response body is null");
  }

  return response.body;
}
