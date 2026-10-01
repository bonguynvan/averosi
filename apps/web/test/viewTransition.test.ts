import { afterEach, describe, expect, test, vi } from "vitest";
import { prefersReducedMotion, runViewTransition, viewTransitionName } from "@/lib/viewTransition";

type FakeDoc = { startViewTransition?: (cb: () => void) => unknown };

function setup(doc: FakeDoc, reduced = false) {
  vi.stubGlobal("document", doc);
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: reduced && q.includes("reduce") }));
}

afterEach(() => vi.unstubAllGlobals());

describe("runViewTransition", () => {
  test("wraps the update in document.startViewTransition when available", () => {
    const start = vi.fn((cb: () => void) => cb());
    setup({ startViewTransition: start });
    const update = vi.fn();
    runViewTransition(update);
    expect(start).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  test("falls back to a direct update when the API is missing", () => {
    setup({});
    const update = vi.fn();
    runViewTransition(update);
    expect(update).toHaveBeenCalledTimes(1);
  });

  test("skips the animation when the user prefers reduced motion", () => {
    const start = vi.fn();
    setup({ startViewTransition: start }, true);
    const update = vi.fn();
    runViewTransition(update);
    expect(start).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
    expect(prefersReducedMotion()).toBe(true);
  });

  test("on the server (no document) it just updates", () => {
    vi.stubGlobal("document", undefined);
    const update = vi.fn();
    runViewTransition(update);
    expect(update).toHaveBeenCalledTimes(1);
  });
});

describe("viewTransitionName", () => {
  test("turns React useId output into a valid, unique CSS ident", () => {
    expect(viewTransitionName("panel", "«r1»")).toBe("panel-r1");
    expect(viewTransitionName("panel", ":R5a:")).toBe("panel-R5a");
  });
});
