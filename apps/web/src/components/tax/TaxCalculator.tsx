"use client";

import { estimateTransferTax, formatVnd, parseVndInput } from "@averosi/core";
import { useId, useState } from "react";

const PARSE_ERRORS: Record<string, string> = {
  EMPTY: "Nhập giá trị giao dịch (VNĐ).",
  INVALID: "Chỉ nhập số nguyên dương, có thể dùng dấu chấm phân cách hàng nghìn (vd: 1.500.000).",
};

/** Runs entirely in the browser; nothing is sent or stored. */
export function TaxCalculator() {
  const inputId = useId();
  const [raw, setRaw] = useState("");
  const parsed = parseVndInput(raw);
  const estimate = parsed.ok ? estimateTransferTax(parsed.value) : null;
  const showError = raw.trim() !== "" && !parsed.ok;

  return (
    <div className="flex flex-col gap-4">
      <label htmlFor={inputId} className="label-caps text-text-muted">
        Giá trị mỗi lần chuyển nhượng (VNĐ)
      </label>
      <input
        id={inputId}
        inputMode="numeric"
        autoComplete="off"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="100.000.000"
        aria-invalid={showError}
        aria-describedby={`${inputId}-hint`}
        className="w-full max-w-sm border border-outline bg-canvas px-3 py-2 font-mono text-[15px] text-text outline-none focus:border-accent"
      />
      <p id={`${inputId}-hint`} className={`text-[13px] ${showError ? "text-danger" : "text-text-muted"}`} role={showError ? "alert" : undefined}>
        {showError && !parsed.ok ? PARSE_ERRORS[parsed.error] : "Thuế suất 0,1% trên giá trị mỗi lần chuyển nhượng."}
      </p>

      <dl className="grid max-w-sm grid-cols-[1fr_auto] gap-x-4 gap-y-2 border-t border-outline-subtle pt-4 font-mono text-[13px]">
        <dt className="text-text-muted">Thuế ước tính (0,1%)</dt>
        <dd data-testid="tax-amount" className="text-right font-semibold text-accent">
          {estimate?.ok ? formatVnd(estimate.value.taxVnd) : "—"}
        </dd>
        <dt className="text-text-muted">Còn lại sau thuế</dt>
        <dd className="text-right text-text">{estimate?.ok ? formatVnd(estimate.value.netVnd) : "—"}</dd>
      </dl>
    </div>
  );
}
