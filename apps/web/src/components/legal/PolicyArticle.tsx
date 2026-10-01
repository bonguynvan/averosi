import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Policy } from "@/lib/policies";

/** Renders repo-owned Markdown. Raw HTML is not enabled (react-markdown default), so content cannot inject markup. */
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
      <div className="policy-prose space-y-3 text-[15px] leading-6 text-text [&_a]:text-accent [&_a]:underline [&_h1]:font-mono [&_h1]:text-[22px] [&_h1]:leading-7 [&_h1]:font-bold [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_strong]:text-text [&_ul]:list-disc">
        <Markdown remarkPlugins={[remarkGfm]}>{policy.body}</Markdown>
      </div>
    </article>
  );
}
