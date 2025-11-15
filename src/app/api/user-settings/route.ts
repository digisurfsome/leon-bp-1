/**
 * POST /api/user-settings
 * Upsert user settings (default model and persona presets)
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-utils";
import { eq } from "drizzle-orm";

interface UpdateSettingsRequest {
  defaultModelPresetId?: string | null;
  defaultPersonaPresetId?: string | null;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const body: UpdateSettingsRequest = await request.json();

    // Check if user already has settings
    const existing = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, user.id))
      .limit(1);

    let result;

    if (existing && existing.length > 0) {
      // Update existing settings
      result = await db
        .update(userSettings)
        .set({
          defaultModelPresetId: body.defaultModelPresetId || null,
          defaultPersonaPresetId: body.defaultPersonaPresetId || null,
          updatedAt: new Date(),
        })
        .where(eq(userSettings.userId, user.id))
        .returning();
    } else {
      // Insert new settings
      result = await db
        .insert(userSettings)
        .values({
          userId: user.id,
          defaultModelPresetId: body.defaultModelPresetId || null,
          defaultPersonaPresetId: body.defaultPersonaPresetId || null,
        })
        .returning();
    }

    return NextResponse.json({
      success: true,
      settings: result[0],
    });
  } catch (error) {
    console.error("Error updating user settings:", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update user settings" },
      { status: 500 }
    );
  }
}
