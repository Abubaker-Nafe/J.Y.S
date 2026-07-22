import { describe, expect, it } from "vitest";
import { parseJsonBody, ValidationError } from "@/lib/validation/common";

function jsonRequest(body: string, headers?: HeadersInit) {
  return new Request("https://shop.example.com/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

describe("bounded JSON request parsing", () => {
  it("parses valid JSON below the byte limit", async () => {
    await expect(parseJsonBody(jsonRequest('{"ok":true}'), 32)).resolves.toEqual({ ok: true });
  });

  it("fast-fails an oversized declared Content-Length", async () => {
    const request = jsonRequest("{}", { "Content-Length": "1024" });
    await expect(parseJsonBody(request, 32)).rejects.toMatchObject<Partial<ValidationError>>({
      status: 413,
      message: "Request body is too large",
    });
  });

  it("enforces the actual UTF-8 byte count when Content-Length is absent", async () => {
    const body = JSON.stringify({ value: "ظ…ط±ط­ط¨ط§" });
    const byteLength = new TextEncoder().encode(body).byteLength;
    const request = jsonRequest(body);
    expect(request.headers.get("content-length")).toBeNull();
    await expect(parseJsonBody(request, byteLength - 1)).rejects.toMatchObject<Partial<ValidationError>>({
      status: 413,
    });
  });

  it("rejects malformed JSON without exposing parser details", async () => {
    await expect(parseJsonBody(jsonRequest("{"), 32)).rejects.toMatchObject<Partial<ValidationError>>({
      status: 400,
      message: "Request body must be valid JSON",
    });
  });
});
