"use client";

import { cloneElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type PointerEvent, type ReactElement } from "react";
import { createPortal } from "react-dom";

let activeTooltip: { id: string; close: () => void } | null = null;

export function Tooltip({ label, children, delay = 1_000 }: { label: string; children: ReactElement<Record<string, unknown>>; delay?: number }) {
  const id = useId();
  const wrapper = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  const cancelTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const close = useCallback(() => {
    cancelTimer();
    setOpen(false);
    if (activeTooltip?.id === id) activeTooltip = null;
  }, [cancelTimer, id]);

  const schedule = useCallback((wait: number) => {
    cancelTimer();
    timer.current = setTimeout(() => {
      activeTooltip?.close();
      activeTooltip = { id, close };
      setOpen(true);
    }, wait);
  }, [cancelTimer, close, id]);

  useLayoutEffect(() => {
    if (!open || !wrapper.current || !bubble.current) return;
    const anchor = wrapper.current.getBoundingClientRect();
    const tip = bubble.current.getBoundingClientRect();
    const gap = 9;
    const margin = 8;
    let left = anchor.left + anchor.width / 2 - tip.width / 2;
    left = Math.min(window.innerWidth - tip.width - margin, Math.max(margin, left));
    let top = anchor.top - tip.height - gap;
    if (top < margin) top = Math.min(window.innerHeight - tip.height - margin, anchor.bottom + gap);
    setPosition({ left, top });
  }, [open, label]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    const onViewportChange = () => close();
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
    };
  }, [close, open]);

  useEffect(() => () => close(), [close]);

  const describedBy = [typeof children.props["aria-describedby"] === "string" ? children.props["aria-describedby"] : "", open ? id : ""].filter(Boolean).join(" ") || undefined;
  const trigger = cloneElement(children, { "aria-describedby": describedBy });
  return <span
    ref={wrapper}
    className="inline-flex"
    onPointerEnter={(event: PointerEvent<HTMLSpanElement>) => { if (event.pointerType !== "touch") schedule(delay); }}
    onPointerLeave={close}
    onFocusCapture={() => schedule(120)}
    onBlurCapture={(event: FocusEvent<HTMLSpanElement>) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close(); }}
  >
    {trigger}
    {open && typeof document !== "undefined" ? createPortal(<span id={id} ref={bubble} role="tooltip" className="pointer-events-none fixed z-[120] max-w-[min(18rem,calc(100dvw-1rem))] rounded-lg bg-ink px-2.5 py-1.5 text-center text-xs font-semibold leading-4 text-white shadow-xl motion-safe:animate-in motion-safe:fade-in" style={{ left: position.left, top: position.top }}>{label}</span>, document.body) : null}
  </span>;
}
