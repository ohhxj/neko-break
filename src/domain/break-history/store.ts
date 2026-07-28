import type { BreakRecord } from "./types";

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export const createBreakHistoryStore = (invoke: Invoke) => ({
  async load(): Promise<BreakRecord[]> {
    return invoke<BreakRecord[]>("load_break_history").catch(() => []);
  },
  async record(record: BreakRecord): Promise<BreakRecord[]> {
    return invoke<BreakRecord[]>("record_break_outcome", { record });
  }
});
