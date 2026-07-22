import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { $queryRaw: mocks.queryRaw } }));

import { GET } from "@/app/api/health/route";

function setValidProductionEnv() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DATABASE_URL", "postgresql://jys_app:private-password@db.internal:5432/jys");
  vi.stubEnv("AUTH_SECRET", "a-unique-production-secret-with-more-than-thirty-two-characters");
  vi.stubEnv("APP_URL", "https://shop.example.com");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://shop.example.com");
  vi.stubEnv("IMAGE_STORAGE_DRIVER", "local");
  vi.stubEnv("MAX_IMAGE_SIZE_MB", "5");
  delete process.env.SEED_ADMIN_EMAIL;
  delete process.env.SEED_ADMIN_PASSWORD;
}

afterEach(() => {
  vi.unstubAllEnvs();
  mocks.queryRaw.mockReset();
});

describe("health readiness", () => {
  it("returns a generic 503 before querying when production configuration is unsafe", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "replace-with-a-random-32-byte-secret");
    delete process.env.DATABASE_URL;

    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "unavailable", service: "jys-commerce" });
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  it("returns ready only after the database probe succeeds", async () => {
    setValidProductionEnv();
    mocks.queryRaw.mockResolvedValue([{ ok: 1 }]);

    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", service: "jys-commerce" });
    expect(mocks.queryRaw).toHaveBeenCalledOnce();
  });

  it("hides database errors behind the generic unavailable response", async () => {
    setValidProductionEnv();
    mocks.queryRaw.mockRejectedValue(new Error("connection details must stay private"));

    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable", service: "jys-commerce" });
  });
});
