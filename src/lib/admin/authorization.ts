import "server-only";

import { redirect } from "next/navigation";
import { AuthenticationError, AuthorizationError } from "@/lib/auth/errors";
import { requireAdmin } from "@/lib/auth/session";
import type { AdminActor, AdminLocale } from "./types";

export async function requireAdminActor(): Promise<AdminActor> {
  const session = await requireAdmin();
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
  };
}

export async function requireAdminPage(locale: AdminLocale): Promise<AdminActor> {
  try {
    return await requireAdminActor();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/admin`)}`);
    }
    if (error instanceof AuthorizationError) redirect(`/${locale}/profile`);
    throw error;
  }
}

export { AuthenticationError, AuthorizationError };
