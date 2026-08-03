// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OrderItemImage } from "./OrderItemImage";

describe("OrderItemImage", () => {
  afterEach(() => cleanup());

  it("renders an accessible placeholder when no image was recorded", () => {
    render(<OrderItemImage src={null} alt="Matte Styling Clay" />);
    expect(screen.getByRole("img", { name: "Matte Styling Clay" }).textContent).toBe("JYS");
  });

  it("replaces an image that fails to load with the accessible placeholder", () => {
    render(<OrderItemImage src="/uploads/missing-image.webp" alt="طين تصفيف مطفي" />);
    fireEvent.error(screen.getByRole("img", { name: "طين تصفيف مطفي" }));
    expect(screen.getByRole("img", { name: "طين تصفيف مطفي" }).textContent).toBe("JYS");
  });
});
