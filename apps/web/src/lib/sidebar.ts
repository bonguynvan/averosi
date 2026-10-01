/** Functional preference cookie (no tracking). Disclosed in content/policies/quyen-rieng-tu.md. */
export const SIDEBAR_COOKIE = "ds_sidebar";
const ONE_YEAR_S = 60 * 60 * 24 * 365;

export function isSidebarCollapsed(cookieValue: string | undefined): boolean {
  return cookieValue === "collapsed";
}

export function sidebarCookie(collapsed: boolean): string {
  return `${SIDEBAR_COOKIE}=${collapsed ? "collapsed" : "expanded"}; Path=/; Max-Age=${ONE_YEAR_S}; SameSite=Lax`;
}
