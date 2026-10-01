import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { FOOTER_LINKS, NAV_ITEMS, navMatch } from "@/lib/nav";
import { POLICY_SLUGS } from "@/lib/policies";
import { REPO_ROOT } from "@/lib/paths";

const APP_DIR = path.join(REPO_ROOT, "apps/web/src/app");

function routeExists(href: string): boolean {
  if ((POLICY_SLUGS as readonly string[]).includes(href.slice(1))) return true;
  return existsSync(path.join(APP_DIR, href === "/" ? "" : href, "page.tsx"));
}

describe("navigation", () => {
  test("every sidebar and footer link points to an existing route", () => {
    const hrefs = [...NAV_ITEMS.map((i) => i.href), ...FOOTER_LINKS.map((l) => l.href)];
    expect(hrefs.filter((href) => !routeExists(href))).toEqual([]);
  });

  test("hrefs are unique", () => {
    const hrefs = NAV_ITEMS.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  test("footer always links all policies", () => {
    const footer = FOOTER_LINKS.map((l) => l.href.slice(1));
    expect(footer).toEqual(expect.arrayContaining([...POLICY_SLUGS]));
  });
});

describe("navMatch", () => {
  test("exact page, child section, alias and root handling", () => {
    expect(navMatch("/thi-truong", "/thi-truong")).toBe("page");
    expect(navMatch("/thi-truong", "/tai-san/btc")).toBe("section");
    expect(navMatch("/phap-ly", "/phap-ly/nghi-dinh-284-2026-nd-cp")).toBe("section");
    expect(navMatch("/", "/thi-truong")).toBeNull();
    expect(navMatch("/", "/")).toBe("page");
    expect(navMatch("/vi", "/vietnam")).toBeNull();
  });
});
