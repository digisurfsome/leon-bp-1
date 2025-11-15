/**
 * Auth Utilities for Server Components and API Routes
 */

import { auth } from "./auth";
import { headers } from "next/headers";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

/**
 * Get the current authenticated user in a server context (API routes, server components)
 * Throws an error if user is not authenticated
 */
export async function getCurrentUser(): Promise<AuthUser> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized: No active session");
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  };
}

/**
 * Get the current authenticated user (nullable version)
 * Returns null if user is not authenticated
 */
export async function getCurrentUserOrNull(): Promise<AuthUser | null> {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}
