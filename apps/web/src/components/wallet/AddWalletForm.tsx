"use client";

import { SUPPORTED_CHAINS } from "@app/core";
import { type FormEvent, useId, useState } from "react";
import type { AddError } from "@/lib/wallet/watchlist";
import { MAX_WATCHED } from "@/lib/wallet/watchlist";

const ERRORS: Record<AddError, string> = {
  UNSUPPORTED_CHAIN: "Chọn một mạng được hỗ trợ.",
  INVALID_ADDRESS: "Địa chỉ không hợp lệ. Nhập địa chỉ EVM dạng 0x… gồm 40 ký tự hex.",
  DUPLICATE: "Ví này đã có trong danh sách.",
  FULL: `Danh sách tối đa ${MAX_WATCHED} ví.`,
};

export function AddWalletForm({ onAdd }: { onAdd: (input: { chain: string; address: string; note?: string }) => AddError | null }) {
  const id = useId();
  const [error, setError] = useState<AddError | null>(null);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const note = String(data.get("note") ?? "");
    const result = onAdd({ chain: String(data.get("chain") ?? ""), address: String(data.get("address") ?? ""), ...(note ? { note } : {}) });
    setError(result);
    if (!result) form.reset();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" aria-describedby={`${id}-note`}>
      <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_12rem_auto] sm:items-end">
        <label className="flex flex-col gap-1">
          <span className="label-caps text-text-muted">Mạng</span>
          <select name="chain" defaultValue="ethereum" className="border border-outline bg-canvas px-2 py-2 font-mono text-[13px] text-text outline-none focus:border-accent">
            {SUPPORTED_CHAINS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="label-caps text-text-muted">Địa chỉ công khai</span>
          <input name="address" required spellCheck={false} autoComplete="off" placeholder="0x…" className="w-full border border-outline bg-canvas px-3 py-2 font-mono text-[13px] text-text outline-none focus:border-accent" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-caps text-text-muted">Ghi chú (tùy chọn)</span>
          <input name="note" maxLength={40} autoComplete="off" placeholder="vd: Ví lạnh" className="w-full border border-outline bg-canvas px-3 py-2 font-mono text-[13px] text-text outline-none focus:border-accent" />
        </label>
        <button type="submit" className="label-caps bg-accent px-4 py-2.5 text-text-on-accent transition-opacity hover:opacity-90 active:scale-[0.98]">
          Thêm ví
        </button>
      </div>
      {error && (
        <p role="alert" className="animate-enter border-l-2 border-danger bg-danger-container px-3 py-2 text-[13px] text-text">
          {ERRORS[error]}
        </p>
      )}
      <p id={`${id}-note`} className="text-[12px] text-text-muted">
        Danh sách và ghi chú chỉ lưu trên trình duyệt này. Máy chủ chỉ nhận địa chỉ để đọc dữ liệu blockchain công khai, không lưu lại.
      </p>
    </form>
  );
}
