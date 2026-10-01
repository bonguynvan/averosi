import { describe, expect, test } from "vitest";
import { SIDEBAR_COOKIE, isSidebarCollapsed, sidebarCookie } from "@/lib/sidebar";

describe("sidebar preference cookie", () => {
  test("only the exact 'collapsed' value collapses the sidebar", () => {
    expect(isSidebarCollapsed("collapsed")).toBe(true);
    expect(isSidebarCollapsed("expanded")).toBe(false);
    expect(isSidebarCollapsed(undefined)).toBe(false);
    expect(isSidebarCollapsed("<script>")).toBe(false);
  });

  test("serializes a first-party, path-wide, lax cookie", () => {
    expect(sidebarCookie(true)).toBe(`${SIDEBAR_COOKIE}=collapsed; Path=/; Max-Age=31536000; SameSite=Lax`);
    expect(sidebarCookie(false)).toContain(`${SIDEBAR_COOKIE}=expanded`);
  });
});
