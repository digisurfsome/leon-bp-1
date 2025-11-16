import { createOpenAI } from "@ai-sdk/openai";

/**
 * OpenRouter client configured to work with multiple AI models
 * OpenRouter provides a unified API for accessing various LLM providers
 */
export const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || "",
  baseURL: "https://openrouter.ai/api/v1",
});

/**
 * Helper function to get a model instance from OpenRouter
 * @param modelId - The model ID from model_presets (e.g., "anthropic/claude-3.5-sonnet")
 */
export function getOpenRouterModel(modelId: string) {
  return openrouter(modelId);
}
