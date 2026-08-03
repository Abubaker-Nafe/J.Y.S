/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Tooltip } from "./tooltip";

describe("Tooltip", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { cleanup(); vi.runOnlyPendingTimers(); vi.useRealTimers(); });

  it("waits about one second for pointer hover and closes on leave", () => {
    render(<Tooltip label="Add to cart"><button type="button">+</button></Tooltip>);
    fireEvent.pointerEnter(screen.getByRole("button"), { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(999));
    expect(screen.queryByRole("tooltip")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("tooltip").textContent).toContain("Add to cart");
    expect(screen.getByRole("button").getAttribute("aria-describedby")).toBeTruthy();
    fireEvent.pointerLeave(screen.getByRole("button"));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("supports keyboard focus and Escape without activating on touch hover", () => {
    render(<Tooltip label="Open menu"><button type="button">menu</button></Tooltip>);
    fireEvent.pointerEnter(screen.getByRole("button"), { pointerType: "touch" });
    act(() => vi.advanceTimersByTime(1_500));
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.focus(screen.getByRole("button"));
    act(() => vi.advanceTimersByTime(120));
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("keeps only one tooltip open", () => {
    render(<><Tooltip label="First"><button type="button">one</button></Tooltip><Tooltip label="Second"><button type="button">two</button></Tooltip></>);
    fireEvent.focus(screen.getByRole("button", { name: "one" }));
    act(() => vi.advanceTimersByTime(120));
    fireEvent.focus(screen.getByRole("button", { name: "two" }));
    act(() => vi.advanceTimersByTime(120));
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
    expect(screen.getByRole("tooltip").textContent).toContain("Second");
  });
});
