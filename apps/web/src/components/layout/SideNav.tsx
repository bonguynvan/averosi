import { NAV_ITEMS } from "@/lib/nav";
import { NavLink } from "./NavLink";

export function SideNav() {
  return (
    <nav aria-label="Điều hướng chính" className="hidden w-64 shrink-0 border-r border-outline-subtle bg-surface-lowest md:block">
      <div className="label-caps px-4 pt-4 pb-2 text-accent">Bàn làm việc</div>
      <ul className="flex flex-col gap-0.5 px-2">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <NavLink item={item} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Mobile: one row that scrolls horizontally inside itself — the page never scrolls sideways. */
export function MobileNav() {
  return (
    <nav aria-label="Điều hướng chính (di động)" className="overflow-x-auto border-b border-outline-subtle bg-surface-lowest md:hidden">
      <ul className="flex w-max">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <NavLink item={item} compact />
          </li>
        ))}
      </ul>
    </nav>
  );
}
