import type { Policy } from "@/lib/policies";
import { Prose } from "../ui/Prose";

export function PolicyArticle({ policy }: { policy: Policy }) {
  const { meta } = policy;
  return (
    <article className="max-w-3xl border border-outline-subtle bg-surface-low p-4 md:p-6">
      <p className="label-caps mb-4 flex flex-wrap gap-x-4 gap-y-1 text-text-muted">
        <span>Phiên bản {meta.version}</span>
        <span>Hiệu lực {meta.effectiveDate}</span>
        <span>Cập nhật {meta.updatedAt}</span>
        <span className="text-warning">{meta.status}</span>
      </p>
      <Prose markdown={policy.body} />
    </article>
  );
}
