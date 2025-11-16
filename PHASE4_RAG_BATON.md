# Phase 4: RAG + Baton + Context Meters

This document explains the RAG (Retrieval Augmented Generation) and Baton system implemented in Phase 4 for Appula Chat.

## Overview

Phase 4 implements an intelligent context management system that automatically summarizes older parts of conversations into compact "memory snapshots" when the context window gets full. This allows for long conversations without losing important context.

## How the Baton System Works

### The Problem

LLMs have limited context windows. As conversations grow longer, we need to manage what gets sent to the model:
- Sending everything: Hits token limits and increases costs
- Discarding old messages: Loses important context and continuity

### The Solution: Baton Passes

The baton system works like a relay race - when the "runner" (active context) gets tired, we pass a "baton" (summary) to the next runner:

1. **Messages accumulate** in the database with token estimates
2. **Context monitoring** tracks total tokens from unarchived messages
3. **Soft limit (yellow zone)**: Warning shown when approaching capacity
4. **Hard limit (baton pass)**: When exceeded:
   - System selects the oldest ~60% of messages
   - Creates a compact summary using an LLM
   - Archives those messages (sets `is_archived = true`)
   - Saves the summary in `chat_session_summaries`
   - Only recent messages stay in raw form

### What Gets Preserved in Summaries

The baton summaries focus on:
- Key decisions made
- Plans and goals
- Important constraints or preferences
- Open TODOs or action items
- Critical context for future turns

Casual chit-chat is omitted to keep summaries compact.

## Context Health Panel

The UI shows real-time context health metrics:

### Progress Bar (Color-Coded)
- **Green** (< 60%): Healthy, plenty of room
- **Yellow** (60-90%): Approaching limit
- **Red** (> 90%): Near capacity, baton pass imminent

### Statistics
- **Baton passes**: Number of summaries created for this session
- **Next baton in**: Estimated tokens until next summary

### Baton Pass Notice
When a baton pass occurs, you'll see:
> 🔁 Baton pass: older messages were summarized into memory. Context reset.

## Environment Configuration

Add these to your `.env.local`:

```bash
# Context limits (in tokens)
APPULA_CONTEXT_SOFT_LIMIT=8000   # Yellow warning threshold
APPULA_CONTEXT_HARD_LIMIT=12000  # Baton pass threshold
```

### Tuning the Limits

**Lower limits (e.g., 4000/6000)**:
- More frequent summaries
- Lower API costs per message
- Risk of losing nuance in very recent context

**Higher limits (e.g., 16000/20000)**:
- Longer raw context preserved
- Higher API costs
- Better for conversations needing exact recent details

**Recommended**: Start with defaults (8000/12000) and adjust based on:
- Your model's context window size
- Average conversation length
- Cost sensitivity

## Database Schema

### chat_sessions
Tracks individual chat sessions.

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| user_id | text | User identifier (currently "dev-user") |
| title | text | Session title |
| created_at | timestamp | Session start time |
| updated_at | timestamp | Last activity time |

### chat_messages
Stores all messages in conversations.

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| session_id | integer | References chat_sessions.id |
| role | text | "user", "assistant", or "system" |
| content | text | Message content |
| model | text | Model used (for assistant messages) |
| approx_tokens | integer | Estimated token count |
| is_archived | boolean | True if summarized into baton |
| created_at | timestamp | Message timestamp |

### chat_session_summaries
Stores baton summary snapshots.

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| session_id | integer | References chat_sessions.id |
| summary | text | Compact conversation summary |
| summary_type | text | Type (currently "baton") |
| token_estimate | integer | Tokens from archived messages |
| coverage_until_message_id | integer | Last message ID in this summary |
| created_at | timestamp | When summary was created |

## Technical Details

### Token Estimation
We use a simple heuristic: **1 token ≈ 4 characters**

This is approximate but sufficient for context management. Actual tokenization varies by model.

### Message Flow

1. **User sends message** → Saved to DB with token estimate
2. **System checks context** → Calculates total from unarchived messages
3. **If over hard limit** → Creates baton summary:
   - Summarizes oldest messages
   - Archives them
   - Inserts summary row
4. **Build LLM context**:
   - Prepend all summaries as "Session memory"
   - Append unarchived messages
   - Send to model
5. **Assistant responds** → Saved to DB with token estimate
6. **Context info returned** → UI updates meters

### Summary Generation

Summaries are created using the same OpenRouter model configured in `OPENAI_MODEL`. The system:
1. Concatenates messages to summarize
2. Sends a specialized prompt emphasizing factual, actionable info
3. Streams the summary response
4. Stores result in database

## Usage Example

```
User: "Let's plan a website redesign"
AI: "Great! What's the main goal?"

[... 50 messages later, approaching hard limit ...]

System: 🔁 Baton pass (behind the scenes)
- Archives first 30 messages
- Creates summary: "User planning website redesign. Goals: improve UX,
  modern design. Constraints: $5k budget, launch by June. Tech stack:
  Next.js. Color preferences: blue/green theme."

User: "What colors did we decide on?"
AI: "Based on our discussion, you wanted a blue/green theme."
   ↑ Pulls from summary, not raw messages
```

## Monitoring and Debugging

### Check Session Summaries
```sql
SELECT * FROM chat_session_summaries
WHERE session_id = YOUR_SESSION_ID
ORDER BY created_at DESC;
```

### View Archived vs Active Messages
```sql
-- Archived messages
SELECT COUNT(*) FROM chat_messages
WHERE session_id = YOUR_SESSION_ID AND is_archived = true;

-- Active messages
SELECT COUNT(*) FROM chat_messages
WHERE session_id = YOUR_SESSION_ID AND is_archived = false;
```

### Check Token Distribution
```sql
SELECT
  role,
  is_archived,
  SUM(approx_tokens) as total_tokens,
  COUNT(*) as message_count
FROM chat_messages
WHERE session_id = YOUR_SESSION_ID
GROUP BY role, is_archived;
```

## Future Enhancements

Potential improvements for future phases:
- **Smart summary retrieval**: Only include relevant summaries (semantic search)
- **User-triggered summaries**: Manual "checkpoint" creation
- **Summary editing**: Allow users to view/modify summaries
- **Multi-session memory**: Share summaries across related sessions
- **External document RAG**: Extend beyond chat history
- **Embeddings**: Store vector representations for better retrieval

## Troubleshooting

**Problem**: Baton passes too frequent
- **Solution**: Increase `APPULA_CONTEXT_HARD_LIMIT`

**Problem**: Important recent context lost
- **Solution**: Adjust the 60% threshold in `createBatonSummary()` to archive less

**Problem**: Summaries too verbose
- **Solution**: Modify the summary prompt to emphasize brevity

**Problem**: Context meters not updating
- **Solution**: Check browser console for header parsing errors
- **Solution**: Verify API is returning `X-Context-Info` header

## Best Practices

1. **Monitor the meters**: Keep an eye on context load during long conversations
2. **Clear old sessions**: Create new chat sessions for unrelated topics
3. **Review summaries**: Periodically check database to ensure quality
4. **Tune for your use case**: Adjust limits based on conversation patterns
5. **Test baton passes**: Have a long conversation to verify summarization quality
