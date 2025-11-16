import { openai } from "@ai-sdk/openai";
import { embed } from "ai";
import { db } from "./db";
import { ragChunks } from "./schema";
import { and, eq, sql } from "drizzle-orm";

export interface RagChunk {
  id: string;
  documentId?: string;
  projectId?: string;
  sessionId?: number;
  content: string;
  embedding?: number[];
  tags?: string[];
}

export interface RagMatch extends RagChunk {
  similarity: number;
}

export interface RagClient {
  upsertChunks(chunks: RagChunk[]): Promise<void>;
  query(opts: {
    userId: string;
    projectId?: string;
    sessionId?: number;
    query: string;
    topK: number;
  }): Promise<RagMatch[]>;
}

/**
 * PostgreSQL-based RAG client using JSONB for embeddings
 * Falls back to in-memory cosine similarity if pgvector is not available
 */
export class PostgresRagClient implements RagClient {
  private embeddingModel: string;

  constructor(embeddingModel?: string) {
    this.embeddingModel =
      embeddingModel ||
      process.env.OPENAI_EMBEDDING_MODEL ||
      "text-embedding-3-small";
  }

  /**
   * Generate embedding for text using OpenAI
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const { embedding } = await embed({
        model: openai.embedding(this.embeddingModel),
        value: text,
      });
      return embedding;
    } catch (error) {
      console.error("Error generating embedding:", error);
      // Return zero vector as fallback
      return new Array(1536).fill(0);
    }
  }

  /**
   * Compute cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Upsert chunks into the database with embeddings
   */
  async upsertChunks(chunks: RagChunk[]): Promise<void> {
    for (const chunk of chunks) {
      // Generate embedding if not provided
      const embedding = chunk.embedding || (await this.generateEmbedding(chunk.content));

      // Estimate tokens
      const tokens = Math.ceil(chunk.content.length / 4);

      // Insert or update chunk
      await db
        .insert(ragChunks)
        .values({
          id: chunk.id || crypto.randomUUID(),
          documentId: chunk.documentId,
          userId: "dev-user", // TODO: Pass from context
          projectId: chunk.projectId,
          sessionId: chunk.sessionId,
          content: chunk.content,
          embedding: embedding as any, // Store as JSONB
          tokens,
          tags: chunk.tags,
        })
        .onConflictDoUpdate({
          target: ragChunks.id,
          set: {
            content: chunk.content,
            embedding: embedding as any,
            tokens,
            tags: chunk.tags,
          },
        });
    }
  }

  /**
   * Query chunks using semantic similarity
   */
  async query(opts: {
    userId: string;
    projectId?: string;
    sessionId?: number;
    query: string;
    topK: number;
  }): Promise<RagMatch[]> {
    const { userId, projectId, sessionId, query, topK } = opts;

    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);

    // Build filter conditions
    const conditions = [eq(ragChunks.userId, userId)];
    if (projectId) {
      conditions.push(eq(ragChunks.projectId, projectId));
    }
    if (sessionId) {
      conditions.push(eq(ragChunks.sessionId, sessionId));
    }

    // Fetch candidate chunks
    const candidates = await db
      .select()
      .from(ragChunks)
      .where(and(...conditions))
      .limit(1000); // Limit candidates for performance

    // Compute similarities in-memory (fallback for no pgvector)
    const matches: RagMatch[] = candidates
      .map((chunk) => {
        const chunkEmbedding = chunk.embedding as number[] | null;
        if (!chunkEmbedding) return null;

        const similarity = this.cosineSimilarity(
          queryEmbedding,
          chunkEmbedding
        );

        return {
          id: chunk.id,
          documentId: chunk.documentId || undefined,
          projectId: chunk.projectId || undefined,
          sessionId: chunk.sessionId || undefined,
          content: chunk.content,
          embedding: chunkEmbedding,
          tags: (chunk.tags as string[]) || undefined,
          similarity,
        };
      })
      .filter((m): m is RagMatch => m !== null)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    return matches;
  }
}

// Singleton instance
let ragClientInstance: RagClient | null = null;

/**
 * Get or create RAG client instance
 */
export function getRagClient(): RagClient {
  if (!ragClientInstance) {
    ragClientInstance = new PostgresRagClient();
  }
  return ragClientInstance;
}
