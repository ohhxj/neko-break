import type { AppSettings } from "../settings/types";
import { createScheduler } from "./scheduler";
import type { SchedulerSnapshot } from "./types";

export const reconcileSchedulerAfterSettingsChange = (
  snapshot: SchedulerSnapshot,
  previousSettings: AppSettings,
  nextSettings: AppSettings,
  setupComplete: boolean,
  at: Date
) => {
  if (!setupComplete) return snapshot;

  const withUpdatedBreakLength: SchedulerSnapshot = {
    ...snapshot,
    activeBreakSeconds: nextSettings.breakMinutes * 60
  };

  if (snapshot.state === "break_active") {
    return withUpdatedBreakLength;
  }

  if (snapshot.state === "paused_today" && !nextSettings.allowPauseToday) {
    return createScheduler(nextSettings, at).start();
  }

  const timingChanged =
    previousSettings.intervalMinutes !== nextSettings.intervalMinutes ||
    previousSettings.breakMinutes !== nextSettings.breakMinutes;

  if (timingChanged && snapshot.state !== "paused_today") {
    return createScheduler(nextSettings, at).start();
  }

  return withUpdatedBreakLength;
};
