import { describe, expect, it, vi } from "vitest";
import { summarizeBreakHistory } from "../../src/domain/break-history/summary";
import { createBreakHistoryStore } from "../../src/domain/break-history/store";
import type { BreakRecord } from "../../src/domain/break-history/types";

const records: BreakRecord[] = [
  {
    sessionId: 1,
    outcome: "completed",
    occurredAt: new Date(2026, 6, 22, 10, 0).toISOString(),
    actualSeconds: 180,
    plannedSeconds: 180
  },
  {
    sessionId: 2,
    outcome: "deferred",
    occurredAt: new Date(2026, 6, 22, 11, 0).toISOString(),
    actualSeconds: 75,
    plannedSeconds: 180
  },
  {
    sessionId: 3,
    outcome: "completed",
    occurredAt: new Date(2026, 6, 21, 17, 0).toISOString(),
    actualSeconds: 180,
    plannedSeconds: 180
  }
];

describe("break history", () => {
  it("summarizes only records from the current local day", () => {
    const summary = summarizeBreakHistory(records, new Date(2026, 6, 22, 12, 0));

    expect(summary.completedCount).toBe(1);
    expect(summary.deferredCount).toBe(1);
    expect(summary.actualSeconds).toBe(255);
    expect(summary.recentRecords.map((record) => record.sessionId)).toEqual([2, 1]);
  });

  it("keeps every record from today available to the history list", () => {
    const manyRecords = Array.from({ length: 5 }, (_, index): BreakRecord => ({
      sessionId: index + 10,
      outcome: index % 2 === 0 ? "completed" : "deferred",
      occurredAt: new Date(2026, 6, 22, 9, index).toISOString(),
      actualSeconds: 60,
      plannedSeconds: 180
    }));

    const summary = summarizeBreakHistory(manyRecords, new Date(2026, 6, 22, 12, 0));

    expect(summary.recentRecords).toHaveLength(5);
    expect(summary.recentRecords.map((record) => record.sessionId)).toEqual([14, 13, 12, 11, 10]);
  });

  it("persists a break outcome through the backend", async () => {
    const invoke = vi.fn().mockResolvedValue(records);
    const store = createBreakHistoryStore(invoke);

    await expect(store.record(records[0]!)).resolves.toEqual(records);
    expect(invoke).toHaveBeenCalledWith("record_break_outcome", {
      record: records[0]
    });
  });
});
