import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/ui/Panel";
import { loadAllPolicies } from "@/lib/policies";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Lịch sử chính sách" };

export default async function PolicyHistoryPage() {
  const policies = await loadAllPolicies();

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <h1 className="font-mono text-[22px] leading-7 font-bold text-text">Lịch sử chính sách</h1>
      <Panel title="Phiên bản hiện hành">
        <table className="w-full font-mono text-[13px]">
          <thead>
            <tr className="label-caps text-left text-text-muted">
              <th className="pb-2 font-bold">Văn bản</th>
              <th className="pb-2 font-bold">Phiên bản</th>
              <th className="pb-2 font-bold">Cập nhật</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((p) => (
              <tr key={p.slug} className="border-t border-outline-subtle">
                <td className="py-2">
                  <Link href={`/${p.slug}`} className="text-accent hover:underline">
                    {p.meta.title}
                  </Link>
                </td>
                <td className="py-2">{p.meta.version}</td>
                <td className="py-2">{p.meta.updatedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-[13px] text-text-muted">
          Toàn bộ lịch sử chỉnh sửa được lưu công khai trong{" "}
          <a href={`${BRAND.sourceRepoUrl}/commits/main/content/policies`} className="text-accent hover:underline" rel="noopener noreferrer">
            kho mã nguồn
          </a>
          .
        </p>
      </Panel>
    </div>
  );
}
