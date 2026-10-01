"use client";

import { SUPPORTED_CHAINS } from "@app/core";
import { useActionState, useId } from "react";
import { type RiskActionState, checkRiskAction } from "@/app/rui-ro/actions";
import { ERROR_COPY } from "@/lib/risk/copy";
import { RiskReport } from "./RiskReport";

const INITIAL: RiskActionState = { status: "idle" };

export function RiskChecker() {
  const id = useId();
  const [state, formAction, isPending] = useActionState(checkRiskAction, INITIAL);

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-3" aria-describedby={`${id}-note`}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-col gap-1 sm:w-40">
            <label htmlFor={`${id}-chain`} className="label-caps text-text-muted">
              Mạng
            </label>
            <select
              id={`${id}-chain`}
              name="chain"
              defaultValue="ethereum"
              className="border border-outline bg-canvas px-2 py-2 font-mono text-[13px] text-text outline-none focus:border-accent"
            >
              {SUPPORTED_CHAINS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor={`${id}-address`} className="label-caps text-text-muted">
              Địa chỉ ví hoặc hợp đồng
            </label>
            <input
              id={`${id}-address`}
              name="address"
              required
              spellCheck={false}
              autoComplete="off"
              placeholder="0x…"
              className="w-full border border-outline bg-canvas px-3 py-2 font-mono text-[13px] text-text outline-none focus:border-accent"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="label-caps bg-accent px-4 py-2 text-text-on-accent transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
          >
            {isPending ? "Đang kiểm tra…" : "Kiểm tra rủi ro"}
          </button>
          <p id={`${id}-note`} className="text-[12px] text-text-muted">
            Chỉ đọc dữ liệu công khai. Không kết nối ví, không lưu địa chỉ bạn nhập.
          </p>
        </div>
      </form>

      <div aria-live="polite" aria-busy={isPending}>
        {state.status === "error" && (
          <p role="alert" className="border-l-2 border-danger bg-danger-container px-3 py-2 text-[13px] text-text">
            {ERROR_COPY[state.error]}
          </p>
        )}
        {state.status === "done" && <RiskReport report={state.report} />}
      </div>
    </div>
  );
}
