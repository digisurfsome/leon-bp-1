# Phase 1 Setup Guide - Appula Chat Base

## Overview

Phase 1 implements a **multi-user, multi-LLM chat application** with:

- ✅ Multi-user support (each user has isolated chat data)
- ✅ Model presets (GPT-4.1-mini, GPT-4o, GPT-5.1, Claude 3.5 Sonnet/Haiku, Gemini 2.0 Flash)
- ✅ Persona presets (General Chat, Strict Coder, Creative Writer, Data Analyst)
- ✅ User settings (default model & persona)
- ✅ Chat sessions with persistence
- ✅ OpenRouter integration for multi-LLM access

## Environment Variables Required

Ensure your cloud environment (or `.env.local`) has:

```env
DATABASE_URL=postgresql://...          # Neon Postgres connection string
OPENROUTER_API_KEY=sk-or-v1-...      # Your OpenRouter API key
```

## Database Setup

### 1. Run Migrations

The migrations have been generated. To apply them to your database:

```bash
npm run db:migrate
```

This will create the following tables:

- `model_presets` - Available LLM models
- `persona_presets` - System prompt templates
- `user_settings` - Per-user defaults
- `chat_sessions` - Chat conversations
- `chat_messages` - Individual messages

### 2. Seed the Database

Populate model and persona presets:

```bash
npm install  # If you haven't already (adds tsx)
npm run db:seed
```

This will add:

**Model Presets:**
- GPT-4.1 Mini (OpenAI)
- GPT-4o (OpenAI)
- GPT-5.1 (OpenAI)
- Claude 3.5 Sonnet (Anthropic)
- Claude 3.5 Haiku (Anthropic)
- Gemini 2.0 Flash (Google)

**Persona Presets:**
- General Chat
- Strict Coder
- Creative Writer
- Data Analyst

## API Endpoints

### Chat

- **POST** `/api/chat` - Send a message and get a response
  - Body: `{ sessionId?, messages, modelPresetId?, personaPresetId? }`

- **GET** `/api/chat/config` - Fetch models, personas, and user settings

- **GET** `/api/chat/sessions` - List all user's chat sessions

- **GET** `/api/chat/sessions/[sessionId]` - Get messages for a session

### User Settings

- **POST** `/api/user-settings` - Update default model/persona
  - Body: `{ defaultModelPresetId?, defaultPersonaPresetId? }`

## Frontend Usage

Navigate to `/chat` to:

1. **Select a model** from the dropdown (top bar)
2. **Select a persona** from the dropdown (top bar)
3. **Start a new chat** or load an existing session (left sidebar)
4. **Send messages** and receive AI responses

## Architecture Highlights

### Data Flow

```
User Input → /api/chat
  ↓
Resolve Model & Persona (from user settings or selected)
  ↓
Build messages with system prompt
  ↓
Call OpenRouter API
  ↓
Persist user message & assistant response
  ↓
Return response to UI
```

### Key Files

- `src/lib/schema.ts` - Database schema (Drizzle ORM)
- `src/lib/models.ts` - Model & persona registry
- `src/lib/openrouter.ts` - OpenRouter API client
- `src/lib/auth-utils.ts` - Auth helpers for API routes
- `src/app/api/chat/route.ts` - Main chat endpoint
- `src/app/chat/page.tsx` - Chat UI

## Next Steps (Future Phases)

Phase 1 is complete! Future phases will add:

- **Phase 2:** Multi-model responses (send to multiple models in parallel)
- **Phase 3:** RAG (Retrieval-Augmented Generation)
- **Phase 4:** Baton handoff (model orchestration)

## Troubleshooting

### Database Connection Issues

If migrations fail with `EAI_AGAIN` or connection errors:

- Verify `DATABASE_URL` is set correctly in your cloud environment
- Ensure your Neon database is accessible
- Try running migrations from the cloud environment console

### OpenRouter API Errors

- Verify `OPENROUTER_API_KEY` is valid
- Check OpenRouter dashboard for quota/limits
- Review error messages in server logs

### UI Not Loading Models/Personas

- Ensure `npm run db:seed` was run successfully
- Check browser console for API errors
- Verify user is authenticated (logged in via Google OAuth)

## Development Commands

```bash
# Start dev server
npm run dev

# Lint code
npm run lint

# Type check
npm run typecheck

# Database operations
npm run db:generate  # Generate new migrations
npm run db:migrate   # Apply migrations
npm run db:seed      # Seed presets
npm run db:studio    # Open Drizzle Studio
```
