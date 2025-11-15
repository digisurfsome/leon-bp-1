/**
 * GET /api/chat/config
 * Returns available model presets, persona presets, and user settings
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { modelPresets, personaPresets, userSettings } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-utils";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const user = await getCurrentUser();

    // Fetch all active model presets
    const models = await db
      .select()
      .from(modelPresets)
      .where(eq(modelPresets.isActive, true))
      .orderBy(modelPresets.createdAt);

    // Fetch all active persona presets
    const personas = await db
      .select()
      .from(personaPresets)
      .where(eq(personaPresets.isActive, true))
      .orderBy(personaPresets.createdAt);

    // Fetch user settings (or null if not set)
    const settings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, user.id))
      .limit(1);

    const userSetting = settings[0] || null;

    return NextResponse.json({
      models,
      personas,
      userSettings: userSetting,
    });
  } catch (error) {
    console.error("Error fetching chat config:", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch chat configuration" },
      { status: 500 }
    );
  }
}
