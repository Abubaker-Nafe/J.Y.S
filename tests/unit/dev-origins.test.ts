import { describe, expect, it } from "vitest";
import { getAllowedDevOrigins } from "@/lib/dev-origins";

describe("getAllowedDevOrigins", () => {
  it("always permits the standard loopback development hosts", () => {
    expect(getAllowedDevOrigins()).toEqual(expect.arrayContaining(["127.0.0.1", "localhost"]));
  });

  it("accepts safe comma-separated local aliases and removes duplicates", () => {
    expect(getAllowedDevOrigins("jys.com, JYS.COM, shop.test")).toEqual([
      "127.0.0.1",
      "localhost",
      "jys.com",
      "shop.test",
    ]);
  });

  it("rejects protocols, ports, paths, and malformed hosts", () => {
    expect(getAllowedDevOrigins("http://jys.com,jys.com:3000,jys.com/path,not a host")).toEqual([
      "127.0.0.1",
      "localhost",
    ]);
  });
});
