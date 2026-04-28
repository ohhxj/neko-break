import type { SchedulerSnapshot } from "../../domain/breaks/types";

export const statusLabel = (snapshot: SchedulerSnapshot) => {
  if (snapshot.state === "paused_today") return "Paused for today";
  if (snapshot.state === "break_active") return "Break happening now";
  if (snapshot.nextBreakAt) return `Next break at ${snapshot.nextBreakAt}`;
  return "Break timer idle";
};
