import { pgTable, text, timestamp, boolean, uuid, real, integer } from "drizzle-orm/pg-core";

// ============================================
// AUTH TABLES (existing better-auth tables)
// ============================================

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified"),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// ============================================
// APPULA CHAT TABLES (Phase 1)
// ============================================

/**
 * Model Presets - Available LLM models via OpenRouter
 * Examples: GPT-4.1-mini, Claude 3.5 Sonnet, Gemini 2.0 Flash
 */
export const modelPresets = pgTable("model_presets", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(), // e.g. "gpt-41-mini", "claude-35-sonnet"
  provider: text("provider").notNull(), // e.g. "openrouter"
  modelName: text("model_name").notNull(), // e.g. "openai/gpt-4.1-mini"
  label: text("label").notNull(), // e.g. "GPT-4.1 Mini (OpenAI)"
  description: text("description"), // Optional human-readable description
  maxOutputTokens: integer("max_output_tokens"), // Optional max tokens
  temperature: real("temperature"), // Optional default temperature
  isActive: boolean("is_active").notNull().default(true), // Can be disabled
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Persona Presets - System prompt templates
 * Examples: general chat, strict coder, creative writer
 */
export const personaPresets = pgTable("persona_presets", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(), // e.g. "general-chat", "strict-coder"
  label: text("label").notNull(), // e.g. "General Chat"
  description: text("description"), // For UI tooltips
  systemPrompt: text("system_prompt").notNull(), // The actual system message
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * User Settings - Per-user defaults for model and persona
 * One row per user (enforced by unique userId)
 */
export const userSettings = pgTable("user_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  defaultModelPresetId: uuid("default_model_preset_id").references(() => modelPresets.id),
  defaultPersonaPresetId: uuid("default_persona_preset_id").references(() => personaPresets.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Chat Sessions - Each user can have multiple chat sessions
 * Each session contains a conversation thread
 */
export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title"), // Nullable, can be auto-generated later
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Chat Messages - Individual messages within a session
 * Tracks which model was used for assistant responses
 */
export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => chatSessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "user" | "assistant" | "system"
  content: text("content").notNull(), // The actual message text
  modelPresetId: uuid("model_preset_id").references(() => modelPresets.id), // Which model answered (for assistant messages)
  personaPresetId: uuid("persona_preset_id").references(() => personaPresets.id), // Which persona was active
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
