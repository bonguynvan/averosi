import type { IndicatorSnapshot } from "@app/core";
import type { IndicatorsResult } from "@/lib/market/backend";
import { Panel } from "../ui/Panel";

const num = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toLocaleString("vi-VN", { maximumFractionDigits: Math.abs(v) < 1 ? 6 : digits, minimumFractionDigits: 0 });

type Row = { label: string; hint: string; value: (s: IndicatorSnapshot) => string };

const ROWS: readonly Row[] = [
  { label: "Giá đóng cửa", hint: "Nến gần nhất (USD)", value: (s) => num(s.close) },
  { label: "SMA 20 / 50 / 200", hint: "Trung bình cộng giá đóng cửa", value: (s) => `${num(s.sma20)} / ${num(s.sma50)} / ${num(s.sma200)}` },
  { label: "EMA 20", hint: "Trung bình lũy thừa", value: (s) => num(s.ema20) },
  { label: "RSI 14", hint: "Thang 0–100 (Wilder)", value: (s) => num(s.rsi14, 1) },
  { label: "MACD 12/26/9", hint: "Đường · tín hiệu · histogram", value: (s) => (s.macd ? `${num(s.macd.line)} · ${num(s.macd.signal)} · ${num(s.macd.histogram)}` : "—") },
  { label: "Bollinger 20, 2σ", hint: "Dưới · giữa · trên", value: (s) => (s.bollinger20 ? `${num(s.bollinger20.lower)} · ${num(s.bollinger20.middle)} · ${num(s.bollinger20.upper)}` : "—") },
  { label: "ATR 14", hint: "Biên độ dao động trung bình (Wilder)", value: (s) => num(s.atr14) },
];

/**
 * Raw indicator values computed server-side (worker or on demand). Descriptive only:
 * no "overbought/oversold" or buy/sell labels (LEGAL_REGISTER R4).
 */
export function TechnicalPanel({ hourly, daily }: { hourly: IndicatorsResult | null; daily: IndicatorsResult | null }) {
  return (
    <Panel title="Chỉ báo kỹ thuật (USD)">
      <div className="overflow-x-auto">
        <table className="w-full font-mono text-[12px]" data-testid="technical-panel">
          <thead>
            <tr className="label-caps text-left text-text-muted">
              <th scope="col" className="pb-2 font-bold">Chỉ báo</th>
              <th scope="col" className="pb-2 text-right font-bold">Khung 1 giờ</th>
              <th scope="col" className="pb-2 text-right font-bold">Khung 1 ngày</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.label} className="border-t border-outline-subtle">
                <th scope="row" className="py-2 pr-3 text-left font-normal">
                  <span className="text-text">{r.label}</span>
                  <span className="block text-[11px] text-text-muted">{r.hint}</span>
                </th>
                <td className="py-2 pr-3 text-right">{hourly ? r.value(hourly.snapshot) : "—"}</td>
                <td className="py-2 text-right">{daily ? r.value(daily.snapshot) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] leading-5 text-text-muted">
        Giá trị thống kê tính trên nến cặp USD pháp định, chỉ để tham khảo. Không phải tín hiệu mua bán và không phải lời khuyên đầu tư.
      </p>
    </Panel>
  );
}
