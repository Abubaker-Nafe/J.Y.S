import { describe, expect, it } from "vitest";
import { loadClientSession } from "@/lib/auth/client-session";

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

describe("loadClientSession", () => {
  it("returns an authenticated user from a valid JSON session", async () => {
    const fetcher = async () => jsonResponse({
      user: { id: "user_1", name: "User", email: "user@example.com", role: "CUSTOMER" },
    });

    await expect(loadClientSession(fetcher as typeof fetch)).resolves.toEqual({
      status: "authenticated",
      user: { id: "user_1", name: "User", email: "user@example.com", role: "CUSTOMER" },
    });
  });

  it("distinguishes a valid unauthenticated response from a request failure", async () => {
    const fetcher = async () => jsonResponse({ user: null });
    await expect(loadClientSession(fetcher as typeof fetch)).resolves.toEqual({
      status: "unauthenticated",
      user: null,
    });
  });

  it("fails closed when an endpoint returns HTML instead of JSON", async () => {
    const fetcher = async () => new Response("<!doctype html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
    await expect(loadClientSession(fetcher as typeof fetch)).resolves.toEqual({
      status: "error",
      user: null,
      error: "unavailable",
    });
  });

  it("terminates a session request that never resolves", async () => {
    const fetcher = ((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    })) as typeof fetch;

    await expect(loadClientSession(fetcher, 10)).resolves.toEqual({
      status: "error",
      user: null,
      error: "timeout",
    });
  });
});
