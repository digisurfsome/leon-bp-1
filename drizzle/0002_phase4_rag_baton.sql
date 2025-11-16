-- Phase 4: Projects table
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Chat sessions with project support
CREATE TABLE "chat_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text,
	"title" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Chat messages
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"model" text,
	"approx_tokens" integer,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- RAG Documents
CREATE TABLE "rag_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text,
	"title" text NOT NULL,
	"source_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- RAG Chunks with JSONB embeddings
CREATE TABLE "rag_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text,
	"user_id" text NOT NULL,
	"project_id" text,
	"session_id" integer,
	"content" text NOT NULL,
	"embedding" jsonb,
	"tokens" integer,
	"tags" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Session Summaries for baton system
CREATE TABLE "session_summaries" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"project_id" text,
	"summary_text" text NOT NULL,
	"token_count" integer NOT NULL,
	"covered_message_from" integer NOT NULL,
	"covered_message_to" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Baton Events tracking
CREATE TABLE "baton_events" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"project_id" text,
	"event_type" text NOT NULL,
	"at_total_tokens" integer,
	"summary_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Foreign key constraints
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_project_id_projects_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "rag_documents" ADD CONSTRAINT "rag_documents_project_id_projects_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "rag_chunks" ADD CONSTRAINT "rag_chunks_document_id_rag_documents_id_fk"
  FOREIGN KEY ("document_id") REFERENCES "public"."rag_documents"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "rag_chunks" ADD CONSTRAINT "rag_chunks_project_id_projects_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "rag_chunks" ADD CONSTRAINT "rag_chunks_session_id_chat_sessions_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "session_summaries" ADD CONSTRAINT "session_summaries_session_id_chat_sessions_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "session_summaries" ADD CONSTRAINT "session_summaries_project_id_projects_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "baton_events" ADD CONSTRAINT "baton_events_session_id_chat_sessions_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "baton_events" ADD CONSTRAINT "baton_events_project_id_projects_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "baton_events" ADD CONSTRAINT "baton_events_summary_id_session_summaries_id_fk"
  FOREIGN KEY ("summary_id") REFERENCES "public"."session_summaries"("id") ON DELETE set null ON UPDATE no action;

-- Indexes for performance
CREATE INDEX "idx_chat_sessions_user_id" ON "chat_sessions"("user_id");
CREATE INDEX "idx_chat_sessions_project_id" ON "chat_sessions"("project_id");
CREATE INDEX "idx_chat_messages_session_id" ON "chat_messages"("session_id");
CREATE INDEX "idx_rag_chunks_project_id" ON "rag_chunks"("project_id");
CREATE INDEX "idx_rag_chunks_session_id" ON "rag_chunks"("session_id");
CREATE INDEX "idx_session_summaries_session_id" ON "session_summaries"("session_id");
CREATE INDEX "idx_baton_events_session_id" ON "baton_events"("session_id");
