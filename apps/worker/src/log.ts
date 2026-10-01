/** Minimal structured logger (JSON lines on stdout/stderr) — no console.log in committed code. */
export interface Log {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

function write(stream: NodeJS.WriteStream, level: string, message: string, fields?: Record<string, unknown>) {
  stream.write(`${JSON.stringify({ t: new Date().toISOString(), level, message, ...fields })}\n`);
}

export const log: Log = {
  info: (m, f) => write(process.stdout, "info", m, f),
  warn: (m, f) => write(process.stderr, "warn", m, f),
  error: (m, f) => write(process.stderr, "error", m, f),
};

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
