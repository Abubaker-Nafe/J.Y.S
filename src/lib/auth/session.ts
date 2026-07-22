import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { assertProductionRuntimeConfig, isUnsafeAuthSecret } from "@/lib/env";
import { AuthenticationError, AuthorizationError } from "./errors";

export const SESSION_COOKIE_NAME = "jys_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

export type AuthSession = {
  user: SessionUser;
  expiresAt: Date;
  /** Present for signed sessions; optional only to keep authorization helpers easy to unit test. */
  issuedAt?: Date;
};

function getSessionSecret(): Uint8Array {
  assertProductionRuntimeConfig();
  const value = process.env.AUTH_SECRET;
  if (isUnsafeAuthSecret(value)) {
    throw new Error("AUTH_SECRET must be a non-placeholder secret of at least 32 characters");
  }
  return new TextEncoder().encode(value);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setIssuedAt()
    .setJti(crypto.randomUUID())
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSessionSecret());
}

export async function readSessionToken(token: string): Promise<AuthSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: ["HS256"],
    });
    if (
      !payload.sub ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      (payload.role !== "CUSTOMER" && payload.role !== "ADMIN") ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    return {
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      },
      issuedAt: new Date(payload.iat * 1_000),
      expiresAt: new Date(payload.exp * 1_000),
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, await createSessionToken(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
    priority: "high",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export async function getSession(): Promise<AuthSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return token ? readSessionToken(token) : null;
}

export async function requireUser(): Promise<AuthSession> {
  assertProductionRuntimeConfig();
  const session = await getSession();
  if (!session) throw new AuthenticationError();

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, role: true, status: true, updatedAt: true },
  });
  if (!user || user.status !== "ACTIVE") throw new AuthenticationError();
  // Password/profile updates touch User.updatedAt and invalidate older signed sessions.
  // One second accommodates JWT's whole-second issued-at precision.
  if (session.issuedAt && session.issuedAt.getTime() + 1_000 < user.updatedAt.getTime()) {
    throw new AuthenticationError("Your session has expired. Please sign in again.");
  }

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    expiresAt: session.expiresAt,
    issuedAt: session.issuedAt,
  };
}

export async function requireAdmin(): Promise<AuthSession> {
  const session = await requireUser();
  if (session.user.role !== "ADMIN") throw new AuthorizationError();
  return session;
}

export function assertResourceOwner(ownerId: string, session: AuthSession): void {
  if (session.user.role !== "ADMIN" && ownerId !== session.user.id) {
    throw new AuthorizationError();
  }
}
