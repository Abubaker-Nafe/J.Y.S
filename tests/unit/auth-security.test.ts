import { afterEach, describe, expect, it } from "vitest";
import { AuthorizationError } from "@/lib/auth/errors";
import {
  assertResourceOwner,
  createSessionToken,
  readSessionToken,
  type AuthSession,
} from "@/lib/auth/session";

const originalSecret = process.env.AUTH_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = originalSecret;
});

describe("signed authentication sessions", () => {
  it("round-trips verified session claims", async () => {
    process.env.AUTH_SECRET = "a-secure-test-secret-that-is-longer-than-32-characters";
    const token = await createSessionToken({
      id: "user_1",
      email: "user@example.com",
      name: "User",
      role: "CUSTOMER",
    });
    const session = await readSessionToken(token);
    expect(session?.user).toMatchObject({ id: "user_1", role: "CUSTOMER" });
  });

  it("rejects a tampered token and fails closed without a secret", async () => {
    process.env.AUTH_SECRET = "a-secure-test-secret-that-is-longer-than-32-characters";
    const token = await createSessionToken({
      id: "user_1",
      email: "user@example.com",
      name: "User",
      role: "CUSTOMER",
    });
    expect(await readSessionToken(`${token.slice(0, -1)}x`)).toBeNull();
    delete process.env.AUTH_SECRET;
    await expect(
      createSessionToken({ id: "user_1", email: "u@example.com", name: "U", role: "CUSTOMER" }),
    ).rejects.toThrow("AUTH_SECRET");
  });

  it("rejects the committed placeholder signing secret", async () => {
    process.env.AUTH_SECRET = "replace-with-a-random-32-byte-secret";
    await expect(
      createSessionToken({ id: "user_1", email: "u@example.com", name: "U", role: "CUSTOMER" }),
    ).rejects.toThrow("non-placeholder");
  });
});

describe("resource authorization", () => {
  const customer: AuthSession = {
    user: { id: "customer_1", email: "c@example.com", name: "C", role: "CUSTOMER" },
    expiresAt: new Date(Date.now() + 1_000),
  };

  it("allows customers to access their own resources only", () => {
    expect(() => assertResourceOwner("customer_1", customer)).not.toThrow();
    expect(() => assertResourceOwner("customer_2", customer)).toThrow(AuthorizationError);
  });

  it("allows admins to inspect customer resources", () => {
    const admin: AuthSession = { ...customer, user: { ...customer.user, role: "ADMIN" } };
    expect(() => assertResourceOwner("customer_2", admin)).not.toThrow();
  });
});
