import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { LegalBar } from "@/components/layout/LegalBar";
import { MobileNav } from "@/components/layout/MobileNav";
import { ShellMetrics } from "@/components/layout/ShellMetrics";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { SideNav } from "@/components/layout/SideNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BRAND } from "@/lib/brand";
import { SIDEBAR_COOKIE, isSidebarCollapsed } from "@/lib/sidebar";
import { inter, jetbrainsMono } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.siteUrl),
  title: { default: `${BRAND.name} — Dữ liệu Web3`, template: `%s · ${BRAND.name}` },
  description:
    "Công cụ mã nguồn mở, miễn phí, chỉ đọc: dữ liệu blockchain công khai, kiểm tra rủi ro ví, pháp lý tài sản mã hóa Việt Nam. Không phải sàn giao dịch.",
};

export const viewport: Viewport = { themeColor: "#000000", colorScheme: "dark" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Reading cookies opts into dynamic rendering, which Next.js needs to attach the per-request CSP nonce (src/proxy.ts).
  const collapsed = isSidebarCollapsed((await cookies()).get(SIDEBAR_COOKIE)?.value);
  return (
    <html lang="vi" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-accent focus:px-3 focus:py-2 focus:text-text-on-accent"
        >
          Bỏ qua điều hướng
        </a>
        {/* Sticky so the legal bar stays visible while scrolling (CLAUDE.md §2). */}
        <div id="shell-top" className="sticky top-0 z-30">
          <SiteHeader />
          <LegalBar />
          <MobileNav />
        </div>
        <ShellMetrics targetId="shell-top" />
        <SmoothScroll />
        <div className="flex flex-1">
          <SideNav initialCollapsed={collapsed} />
          <main id="main" className="terminal-grid min-w-0 flex-1 px-4 py-6">
            {children}
          </main>
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
