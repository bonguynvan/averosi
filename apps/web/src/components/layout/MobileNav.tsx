import { NAV_ITEMS } from "@/lib/nav";
import { NavLink } from "./NavLink";

/** Mobile: one row that scrolls horizontally inside itself — the page never scrolls sideways. */
export function MobileNav() {
  return (
    <nav aria-label="Điều hướng chính (di động)" className="overflow-x-auto border-b border-outline-subtle bg-surface-lowest md:hidden">
      <ul className="flex w-max">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <NavLink item={item} variant="compact" />
          </li>
        ))}
      </ul>
    </nav>
  );
}
