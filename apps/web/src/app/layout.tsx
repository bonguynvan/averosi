import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { LegalBar } from "@/components/layout/LegalBar";
import { MobileNav, SideNav } from "@/components/layout/SideNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BRAND } from "@/lib/brand";
import { inter, jetbrainsMono } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.siteUrl),
  title: { default: `${BRAND.name} — Dữ liệu Web3 cho người Việt`, template: `%s · ${BRAND.name}` },
  description:
    "Công cụ mã nguồn mở, miễn phí, chỉ đọc: dữ liệu blockchain công khai, kiểm tra rủi ro ví, pháp lý tài sản mã hóa Việt Nam. Không phải sàn giao dịch.",
};

export const viewport: Viewport = { themeColor: "#000000", colorScheme: "dark" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Opt into dynamic rendering so Next.js can attach the per-request CSP nonce (src/proxy.ts).
  await connection();
  return (
    <html lang="vi" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:bg-accent focus:px-3 focus:py-2 focus:text-text-on-accent">
          Bỏ qua điều hướng
        </a>
        <SiteHeader />
        <LegalBar />
        <MobileNav />
        <div className="flex flex-1">
          <SideNav />
          <main id="main" className="terminal-grid min-w-0 flex-1 px-4 py-6">
            {children}
          </main>
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
