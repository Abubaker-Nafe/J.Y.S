import { fetchWithTimeout, RequestTimeoutError } from "@/lib/http/client";

export type ClientSessionUser = {
  id?: string;
  name: string;
  email: string;
  role?: string;
};

export type ClientSessionResult =
  | { status: "authenticated"; user: ClientSessionUser }
  | { status: "unauthenticated"; user: null }
  | { status: "error"; user: null; error: "timeout" | "unavailable" };

function isSessionUser(value: unknown): value is ClientSessionUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Record<string, unknown>;
  return typeof user.name === "string" && typeof user.email === "string";
}

export async function loadClientSession(
  fetcher: typeof fetch = fetch,
  timeoutMs = 10_000,
): Promise<ClientSessionResult> {
  try {
    const response = await fetchWithTimeout(
      "/api/auth/session",
      { headers: { Accept: "application/json" }, cache: "no-store" },
      timeoutMs,
      fetcher,
    );
    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
      return { status: "error", user: null, error: "unavailable" };
    }

    const payload = await response.json() as { user?: unknown };
    if (payload.user === null) return { status: "unauthenticated", user: null };
    if (isSessionUser(payload.user)) return { status: "authenticated", user: payload.user };
    return { status: "error", user: null, error: "unavailable" };
  } catch (error) {
    const timedOut = error instanceof RequestTimeoutError
      || (error instanceof DOMException && error.name === "TimeoutError");
    return { status: "error", user: null, error: timedOut ? "timeout" : "unavailable" };
  }
}
