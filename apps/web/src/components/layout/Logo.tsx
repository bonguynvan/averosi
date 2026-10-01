/** Inline mark from the Stitch logo screen (no remote image hosts). */
export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 36 36" className="h-7 w-7" aria-hidden="true" fill="none">
        <rect x="0.75" y="0.75" width="34.5" height="34.5" className="fill-surface-lowest stroke-accent" strokeWidth="1.5" />
        <path d="M8 26L18 9L28 26" className="stroke-accent" strokeWidth="2.5" strokeLinecap="square" />
        <path d="M12 21H24" className="stroke-accent-soft" strokeWidth="2" />
        <circle cx="18" cy="15" r="2" className="fill-accent" />
      </svg>
      <span className="font-mono text-base font-extrabold tracking-widest text-text">
        AVER<span className="text-accent">OSI</span>
      </span>
    </span>
  );
}
