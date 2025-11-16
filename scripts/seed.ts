/**
 * Seed script to populate initial model presets and persona presets
 * Run with: npx tsx scripts/seed.ts
 */

import { db } from "../src/lib/db";
import { modelPresets, personaPresets } from "../src/lib/schema";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  // Seed model presets
  const models = [
    {
      id: "gpt-4o",
      provider: "openrouter",
      modelId: "openai/gpt-4o",
      displayName: "GPT-4o",
      description: "OpenAI's most capable multimodal model",
      isActive: true,
    },
    {
      id: "claude-3.5-sonnet",
      provider: "openrouter",
      modelId: "anthropic/claude-3.5-sonnet",
      displayName: "Claude 3.5 Sonnet",
      description: "Anthropic's most intelligent model",
      isActive: true,
    },
    {
      id: "gemini-2.0-flash-exp",
      provider: "openrouter",
      modelId: "google/gemini-2.0-flash-exp:free",
      displayName: "Gemini 2.0 Flash",
      description: "Google's fast multimodal model (free)",
      isActive: true,
    },
    {
      id: "llama-3.3-70b",
      provider: "openrouter",
      modelId: "meta-llama/llama-3.3-70b-instruct",
      displayName: "Llama 3.3 70B",
      description: "Meta's open-source flagship model",
      isActive: true,
    },
  ];

  for (const model of models) {
    // Check if already exists
    const existing = await db
      .select()
      .from(modelPresets)
      .where(eq(modelPresets.id, model.id))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(modelPresets).values(model);
      console.log(`✓ Inserted model: ${model.displayName}`);
    } else {
      console.log(`- Model already exists: ${model.displayName}`);
    }
  }

  // Seed persona presets
  const personas = [
    {
      id: "helpful-assistant",
      name: "Helpful Assistant",
      systemPrompt:
        "You are a helpful, harmless, and honest AI assistant. Provide clear, accurate, and concise responses.",
      description: "General-purpose helpful assistant",
      isActive: true,
    },
    {
      id: "technical-expert",
      name: "Technical Expert",
      systemPrompt:
        "You are a technical expert with deep knowledge in programming, system architecture, and engineering. Provide detailed technical explanations with code examples when relevant.",
      description: "Expert in technical and engineering topics",
      isActive: true,
    },
    {
      id: "creative-writer",
      name: "Creative Writer",
      systemPrompt:
        "You are a creative writer with a flair for storytelling, metaphors, and engaging prose. Help users craft compelling narratives and creative content.",
      description: "Specializes in creative and narrative writing",
      isActive: true,
    },
  ];

  for (const persona of personas) {
    const existing = await db
      .select()
      .from(personaPresets)
      .where(eq(personaPresets.id, persona.id))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(personaPresets).values(persona);
      console.log(`✓ Inserted persona: ${persona.name}`);
    } else {
      console.log(`- Persona already exists: ${persona.name}`);
    }
  }

  console.log("\n✓ Seeding complete!");
}

seed()
  .catch((error) => {
    console.error("Error seeding database:", error);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });
