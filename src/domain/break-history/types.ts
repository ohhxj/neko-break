export type BreakOutcome = "completed" | "deferred";

export type BreakRecord = {
  sessionId: number;
  outcome: BreakOutcome;
  occurredAt: string;
  actualSeconds: number;
  plannedSeconds: number;
};

export type BreakHistorySummary = {
  completedCount: number;
  deferredCount: number;
  actualSeconds: number;
  recentRecords: BreakRecord[];
};
