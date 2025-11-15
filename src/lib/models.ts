/**
 * Model Registry & Presets for Appula Chat
 * Provides OpenRouter model definitions and utility functions
 */

export interface ModelPreset {
  id?: string; // UUID from DB (optional for built-in presets)
  slug: string;
  provider: string;
  modelName: string; // OpenRouter model identifier
  label: string;
  description?: string;
  maxOutputTokens?: number;
  temperature?: number;
  isActive: boolean;
}

export interface PersonaPreset {
  id?: string; // UUID from DB (optional for built-in presets)
  slug: string;
  label: string;
  description?: string;
  systemPrompt: string;
  isActive: boolean;
}

/**
 * Built-in Model Presets (OpenRouter)
 * These are defaults that will be seeded into the database
 */
export const BUILT_IN_MODELS: Omit<ModelPreset, "id">[] = [
  {
    slug: "gpt-41-mini",
    provider: "openrouter",
    modelName: "openai/gpt-4.1-mini",
    label: "GPT-4.1 Mini (OpenAI)",
    description: "Fast and cost-effective GPT-4.1 variant, ideal for most conversations",
    maxOutputTokens: 16384,
    temperature: 0.7,
    isActive: true,
  },
  {
    slug: "gpt-4o",
    provider: "openrouter",
    modelName: "openai/gpt-4o",
    label: "GPT-4o (OpenAI)",
    description: "Multimodal GPT-4o, excellent for complex reasoning",
    maxOutputTokens: 16384,
    temperature: 0.7,
    isActive: true,
  },
  {
    slug: "gpt-51",
    provider: "openrouter",
    modelName: "openai/gpt-5.1",
    label: "GPT-5.1 (OpenAI)",
    description: "Latest flagship OpenAI model (if available via OpenRouter)",
    maxOutputTokens: 32768,
    temperature: 0.7,
    isActive: true,
  },
  {
    slug: "claude-35-sonnet",
    provider: "openrouter",
    modelName: "anthropic/claude-3.5-sonnet",
    label: "Claude 3.5 Sonnet (Anthropic)",
    description: "Powerful reasoning and coding capabilities",
    maxOutputTokens: 8192,
    temperature: 0.7,
    isActive: true,
  },
  {
    slug: "claude-35-haiku",
    provider: "openrouter",
    modelName: "anthropic/claude-3.5-haiku",
    label: "Claude 3.5 Haiku (Anthropic)",
    description: "Fast and efficient Claude model",
    maxOutputTokens: 8192,
    temperature: 0.7,
    isActive: true,
  },
  {
    slug: "gemini-2-flash",
    provider: "openrouter",
    modelName: "google/gemini-2.0-flash-exp:free",
    label: "Gemini 2.0 Flash (Google)",
    description: "Fast and capable Google model",
    maxOutputTokens: 8192,
    temperature: 0.7,
    isActive: true,
  },
];

/**
 * Built-in Persona Presets
 * These are default system prompts that will be seeded
 */
export const BUILT_IN_PERSONAS: Omit<PersonaPreset, "id">[] = [
  {
    slug: "general-chat",
    label: "General Chat",
    description: "Friendly, helpful assistant for everyday conversations",
    systemPrompt:
      "You are a helpful, friendly, and knowledgeable AI assistant. Provide clear, accurate, and engaging responses. Be conversational but professional.",
    isActive: true,
  },
  {
    slug: "strict-coder",
    label: "Strict Coder",
    description: "Focused on writing clean, production-ready code",
    systemPrompt:
      "You are an expert software engineer. Write clean, efficient, well-documented code. Follow best practices, use TypeScript types, handle edge cases, and prioritize maintainability. Be direct and technical.",
    isActive: true,
  },
  {
    slug: "creative-writer",
    label: "Creative Writer",
    description: "Imaginative and expressive for creative tasks",
    systemPrompt:
      "You are a creative and imaginative writer. Help users with storytelling, brainstorming, and creative content. Be expressive, engaging, and think outside the box.",
    isActive: true,
  },
  {
    slug: "data-analyst",
    label: "Data Analyst",
    description: "Analytical and detail-oriented for data tasks",
    systemPrompt:
      "You are a detail-oriented data analyst. Help users understand data, create analyses, and extract insights. Be precise, quantitative, and explain your reasoning clearly.",
    isActive: true,
  },
];

/**
 * Get the default model preset (fallback if user has no default set)
 */
export function getDefaultModelPreset(): Omit<ModelPreset, "id"> {
  return BUILT_IN_MODELS[0]; // GPT-4.1 Mini as default
}

/**
 * Get the default persona preset (fallback if user has no default set)
 */
export function getDefaultPersonaPreset(): Omit<PersonaPreset, "id"> {
  return BUILT_IN_PERSONAS[0]; // General Chat as default
}
