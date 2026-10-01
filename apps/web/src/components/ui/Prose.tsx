import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const PROSE = [
  "space-y-3 text-[15px] leading-7 text-text",
  "[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2",
  "[&_h1]:font-mono [&_h1]:text-[22px] [&_h1]:leading-7 [&_h1]:font-bold",
  "[&_h2]:mt-6 [&_h2:first-child]:mt-0 [&_h2]:font-mono [&_h2]:text-[16px] [&_h2]:font-semibold [&_h2]:text-accent",
  "[&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-5 [&_li]:mt-1 [&_strong]:text-text",
  "[&_table]:w-full [&_table]:border-collapse [&_table]:font-mono [&_table]:text-[13px]",
  "[&_th]:border-b [&_th]:border-outline [&_th]:py-2 [&_th]:pr-3 [&_th]:text-left [&_th]:text-text-muted",
  "[&_td]:border-b [&_td]:border-outline-subtle [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top",
].join(" ");

/** Renders repo-owned Markdown. Raw HTML stays disabled (react-markdown default), so content cannot inject markup. */
export function Prose({ markdown }: { markdown: string }) {
  return (
    <div className={PROSE}>
      <div className="overflow-x-auto">
        <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
      </div>
    </div>
  );
}
