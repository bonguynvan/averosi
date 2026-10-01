import Link from "next/link";
import { FOOTER_LINKS, SOURCE_REPO_URL } from "@/lib/nav";
import { loadAllPolicies } from "@/lib/policies";

export async function SiteFooter() {
  const policies = await loadAllPolicies();
  const versions = policies.map((p) => `${p.meta.title} v${p.meta.version}`).join(" · ");

  return (
    <footer className="border-t border-outline-subtle bg-surface-lowest px-4 py-3 font-mono text-[11px] text-text-muted">
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {FOOTER_LINKS.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="hover:text-accent">
              {link.label}
            </Link>
          </li>
        ))}
        <li>
          <a href={SOURCE_REPO_URL} className="hover:text-accent" rel="noopener noreferrer">
            Mã nguồn (Apache-2.0)
          </a>
        </li>
      </ul>
      <p className="mt-2">{versions}</p>
    </footer>
  );
}
