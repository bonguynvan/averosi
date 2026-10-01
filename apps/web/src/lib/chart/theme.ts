"use client";

/** Canvas needs concrete colours: read them from design tokens so design/tokens.css stays the single source. */
function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--ds-color-${name}`).trim();
}

export async function buildTerminalTheme() {
  const { DARK_TERMINAL } = await import("@tradecanvas/chart");
  return {
    ...DARK_TERMINAL,
    name: "ds-terminal",
    background: token("canvas"),
    text: token("text"),
    textSecondary: token("text-muted"),
    grid: token("surface-low"),
    crosshair: token("accent"),
    candleUp: token("up"),
    candleDown: token("down"),
    candleUpWick: token("up"),
    candleDownWick: token("down"),
    volumeUp: `${token("up")}55`,
    volumeDown: `${token("down")}55`,
    axisLine: token("outline-subtle"),
    axisLabel: token("text-muted"),
    axisLabelBackground: token("surface"),
  };
}
