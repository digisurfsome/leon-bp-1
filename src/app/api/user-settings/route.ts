import { db } from "@/lib/db";
import { userSettings } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

interface UserSettingsRequest {
  defaultModelKey?: string | null;
  defaultPersonaKey?: string | null;
}

export async function POST(req: Request) {
  try {
    // Get authenticated user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body: UserSettingsRequest = await req.json();

    // Check if settings exist
    const existing = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    let result;
    if (existing.length) {
      // Update existing settings
      result = await db
        .update(userSettings)
        .set({
          defaultModelKey: body.defaultModelKey,
          defaultPersonaKey: body.defaultPersonaKey,
          updatedAt: new Date(),
        })
        .where(eq(userSettings.userId, userId))
        .returning();
    } else {
      // Create new settings
      result = await db
        .insert(userSettings)
        .values({
          userId,
          defaultModelKey: body.defaultModelKey,
          defaultPersonaKey: body.defaultPersonaKey,
        })
        .returning();
    }

    return Response.json(result[0]);
  } catch (error) {
    console.error("Error updating user settings:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
