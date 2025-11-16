import { db } from "@/lib/db";
import { modelPresets, personaPresets, userSettings } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET() {
  try {
    // Get authenticated user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch active models
    const models = await db
      .select()
      .from(modelPresets)
      .where(eq(modelPresets.isActive, true));

    // Fetch active personas
    const personas = await db
      .select()
      .from(personaPresets)
      .where(eq(personaPresets.isActive, true));

    // Fetch user settings
    const settings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    return Response.json({
      models,
      personas,
      userSettings: settings[0] || null,
    });
  } catch (error) {
    console.error("Error fetching chat config:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
