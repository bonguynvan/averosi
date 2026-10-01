import { type Log, errorMessage } from "./log";

/**
 * Runs `task` now and then every `intervalMs`, never overlapping itself: the next run is scheduled
 * after the previous one settles. Failures are logged and the schedule continues.
 */
export function every(name: string, intervalMs: number, task: () => Promise<unknown>, log: Pick<Log, "error">): { stop(): void } {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const run = async () => {
    if (stopped) return;
    try {
      await task();
    } catch (e) {
      log.error("job failed", { job: name, error: errorMessage(e) });
    }
    if (!stopped) timer = setTimeout(run, intervalMs);
  };

  void run();
  return {
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}
