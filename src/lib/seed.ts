/**
 * Database Seeding Script
 * Seeds model presets and persona presets into the database
 * Run with: npx tsx src/lib/seed.ts
 */

import { db } from "./db";
import { modelPresets, personaPresets } from "./schema";
import { BUILT_IN_MODELS, BUILT_IN_PERSONAS } from "./models";
import { eq } from "drizzle-orm";

async function seedDatabase() {
  console.log("🌱 Starting database seed...");

  try {
    // Seed Model Presets
    console.log("\n📦 Seeding model presets...");
    for (const model of BUILT_IN_MODELS) {
      // Check if model already exists
      const existing = await db
        .select()
        .from(modelPresets)
        .where(eq(modelPresets.slug, model.slug))
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`  ✓ Model "${model.slug}" already exists, skipping`);
      } else {
        await db.insert(modelPresets).values(model);
        console.log(`  + Added model: ${model.label}`);
      }
    }

    // Seed Persona Presets
    console.log("\n🎭 Seeding persona presets...");
    for (const persona of BUILT_IN_PERSONAS) {
      // Check if persona already exists
      const existing = await db
        .select()
        .from(personaPresets)
        .where(eq(personaPresets.slug, persona.slug))
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`  ✓ Persona "${persona.slug}" already exists, skipping`);
      } else {
        await db.insert(personaPresets).values(persona);
        console.log(`  + Added persona: ${persona.label}`);
      }
    }

    console.log("\n✅ Database seeding completed successfully!");
  } catch (error) {
    console.error("\n❌ Error seeding database:", error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the seed function
seedDatabase();
