import { Panel } from "./Panel";

/** Placeholder for unbuilt modules. Never render invented numbers in its place. */
export function ComingSoon({ title, description, rules }: { title: string; description: string; rules: readonly string[] }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-mono text-[22px] leading-7 font-bold text-text">{title}</h1>
      <Panel
        title="Đang phát triển"
        aside={<span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-led bg-warning motion-reduce:animate-none" />}
      >
        <p className="max-w-prose text-[15px] leading-6 text-text-muted">{description}</p>
        <h3 className="label-caps mt-4 mb-2 text-text-muted">Nguyên tắc áp dụng</h3>
        <ul className="list-inside list-disc space-y-1 text-[13px] text-text-muted">
          {rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
