import type { BreakHistorySummary, BreakRecord } from "./types";

const localDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const summarizeBreakHistory = (
  records: BreakRecord[],
  at: Date
): BreakHistorySummary => {
  const today = localDateKey(at);
  const todayRecords = records
    .filter((record) => localDateKey(new Date(record.occurredAt)) === today)
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));

  return {
    completedCount: todayRecords.filter((record) => record.outcome === "completed").length,
    deferredCount: todayRecords.filter((record) => record.outcome === "deferred").length,
    actualSeconds: todayRecords.reduce((total, record) => total + record.actualSeconds, 0),
    recentRecords: todayRecords
  };
};
