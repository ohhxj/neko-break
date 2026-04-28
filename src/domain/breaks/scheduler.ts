import { addMinutes, toIsoOrNull } from "../../lib/time";
import type { AppSettings } from "../settings/types";
import type { SchedulerSnapshot } from "./types";

export type SchedulerController = {
  start: () => SchedulerSnapshot;
  triggerBreak: () => SchedulerSnapshot;
  finishBreak: (at: Date) => SchedulerSnapshot;
  delayOnce: (minutes: number, at: Date) => SchedulerSnapshot;
  pauseToday: () => SchedulerSnapshot;
};

export const createScheduler = (settings: AppSettings, now: Date): SchedulerController => {
  let state: SchedulerSnapshot = {
    state: "idle",
    nextBreakAt: null,
    remainingSeconds: 0,
    activeBreakSeconds: settings.breakMinutes * 60
  };

  return {
    start() {
      const nextBreak = addMinutes(now, settings.intervalMinutes);
      state = {
        state: "counting",
        nextBreakAt: toIsoOrNull(nextBreak),
        remainingSeconds: settings.intervalMinutes * 60,
        activeBreakSeconds: settings.breakMinutes * 60
      };
      return state;
    },
    triggerBreak() {
      state = {
        ...state,
        state: "break_active",
        remainingSeconds: settings.breakMinutes * 60
      };
      return state;
    },
    finishBreak(at) {
      const nextBreak = addMinutes(at, settings.intervalMinutes);
      state = {
        state: "counting",
        nextBreakAt: toIsoOrNull(nextBreak),
        remainingSeconds: settings.intervalMinutes * 60,
        activeBreakSeconds: settings.breakMinutes * 60
      };
      return state;
    },
    delayOnce(minutes, at) {
      const nextBreak = addMinutes(at, minutes);
      state = {
        ...state,
        state: "delayed",
        nextBreakAt: toIsoOrNull(nextBreak),
        remainingSeconds: minutes * 60
      };
      return state;
    },
    pauseToday() {
      state = {
        ...state,
        state: "paused_today",
        nextBreakAt: null,
        remainingSeconds: 0
      };
      return state;
    }
  };
};
