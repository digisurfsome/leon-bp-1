import {
  pgTable,
  text,
  timestamp,
  boolean,
  serial,
  integer,
  jsonb,
  uuid,
} from "drizzle-orm/pg-core";

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

// Phase 4: Projects for multi-project RAG
export const projects = pgTable("projects", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Chat tables for Phase 4: RAG + Baton system
export const chatSessions = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  projectId: text("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  title: text("title"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => chatSessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user', 'assistant', 'system'
  content: text("content").notNull(),
  model: text("model"), // Which model was used (for assistant messages)
  approxTokens: integer("approx_tokens"), // Token estimate for context management
  isArchived: boolean("is_archived").notNull().default(false), // For baton system
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// RAG Documents
export const ragDocuments = pgTable("rag_documents", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  projectId: text("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  title: text("title").notNull(),
  sourceType: text("source_type").notNull(), // 'manual', 'upload', 'scraped', etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// RAG Chunks with embeddings
export const ragChunks = pgTable("rag_chunks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  documentId: text("document_id").references(() => ragDocuments.id, {
    onDelete: "cascade",
  }),
  userId: text("user_id").notNull(),
  projectId: text("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  sessionId: integer("session_id").references(() => chatSessions.id, {
    onDelete: "set null",
  }),
  content: text("content").notNull(),
  embedding: jsonb("embedding"), // Store as JSONB array (fallback if pgvector not available)
  tokens: integer("tokens"),
  tags: jsonb("tags").$type<string[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Session Summaries (for baton system)
export const sessionSummaries = pgTable("session_summaries", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: integer("session_id")
    .notNull()
    .references(() => chatSessions.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  summaryText: text("summary_text").notNull(),
  tokenCount: integer("token_count").notNull(),
  coveredMessageFrom: integer("covered_message_from").notNull(),
  coveredMessageTo: integer("covered_message_to").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Baton Events tracking
export const batonEvents = pgTable("baton_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: integer("session_id")
    .notNull()
    .references(() => chatSessions.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  eventType: text("event_type").notNull(), // 'summary_created', 'context_reset', etc.
  atTotalTokens: integer("at_total_tokens"),
  summaryId: text("summary_id").references(() => sessionSummaries.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
