import { describe, expect, it } from "vitest";
import { currencyFromSetting } from "@/lib/domain/currency";

describe("commerce currency settings", () => {
  it("reads the configured ISO code from the persisted settings shape", () => {
    expect(currencyFromSetting({ code: "USD", symbolEn: "$" })).toBe("USD");
    expect(currencyFromSetting("EUR")).toBe("EUR");
  });

  it("uses ILS when the setting is absent or malformed", () => {
    expect(currencyFromSetting(undefined)).toBe("ILS");
    expect(currencyFromSetting({ code: "usd" })).toBe("ILS");
    expect(currencyFromSetting({ code: "USDD" })).toBe("ILS");
  });
});
