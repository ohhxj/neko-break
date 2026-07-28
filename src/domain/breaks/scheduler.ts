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

const parseClockMinutes = (value: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const dateAtClockMinutes = (date: Date, clockMinutes: number, dayOffset = 0) => {
  const next = new Date(date);
  next.setDate(next.getDate() + dayOffset);
  next.setHours(Math.floor(clockMinutes / 60), clockMinutes % 60, 0, 0);
  return next;
};

const isWithinClockWindow = (currentMinutes: number, startMinutes: number, endMinutes: number) =>
  startMinutes < endMinutes
    ? currentMinutes >= startMinutes && currentMinutes < endMinutes
    : currentMinutes >= startMinutes || currentMinutes < endMinutes;

const companionHoursSnapshot = (settings: AppSettings, at: Date): SchedulerSnapshot | null => {
  if (!settings.companionEnabled) return null;
  const startMinutes = parseClockMinutes(settings.companionStart);
  const endMinutes = parseClockMinutes(settings.companionEnd);
  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) return null;

  const currentMinutes = at.getHours() * 60 + at.getMinutes();
  if (isWithinClockWindow(currentMinutes, startMinutes, endMinutes)) return null;

  const startsAt = dateAtClockMinutes(
    at,
    startMinutes,
    currentMinutes < startMinutes ? 0 : 1
  );
  return {
    state: "outside_companion_hours",
    nextBreakAt: toIsoOrNull(startsAt),
    remainingSeconds: Math.max(0, Math.round((startsAt.getTime() - at.getTime()) / 1000)),
    activeBreakSeconds: settings.breakMinutes * 60
  };
};

const quietHoursSnapshot = (settings: AppSettings, at: Date): SchedulerSnapshot | null => {
  if (!settings.doNotDisturbEnabled) return null;
  const startMinutes = parseClockMinutes(settings.doNotDisturbStart);
  const endMinutes = parseClockMinutes(settings.doNotDisturbEnd);
  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) return null;

  const currentMinutes = at.getHours() * 60 + at.getMinutes();
  const sameDayWindow = startMinutes < endMinutes;
  const active = isWithinClockWindow(currentMinutes, startMinutes, endMinutes);
  if (!active) return null;

  const endsAt = sameDayWindow
    ? dateAtClockMinutes(at, endMinutes)
    : dateAtClockMinutes(at, endMinutes, currentMinutes < endMinutes ? 0 : 1);
  return {
    state: "quiet_hours",
    nextBreakAt: toIsoOrNull(endsAt),
    remainingSeconds: Math.max(0, Math.round((endsAt.getTime() - at.getTime()) / 1000)),
    activeBreakSeconds: settings.breakMinutes * 60
  };
};

export const createScheduler = (settings: AppSettings, now: Date): SchedulerController => {
  let state: SchedulerSnapshot = {
    state: "idle",
    nextBreakAt: null,
    remainingSeconds: 0,
    activeBreakSeconds: settings.breakMinutes * 60
  };
  const startAt = (at: Date) => {
    const companionSnapshot = companionHoursSnapshot(settings, at);
    if (companionSnapshot) {
      state = companionSnapshot;
      return state;
    }

    const quietSnapshot = quietHoursSnapshot(settings, at);
    if (quietSnapshot) {
      state = quietSnapshot;
      return state;
    }

    const nextBreak = addMinutes(at, settings.intervalMinutes);
    state = {
      state: "counting",
      nextBreakAt: toIsoOrNull(nextBreak),
      remainingSeconds: settings.intervalMinutes * 60,
      activeBreakSeconds: settings.breakMinutes * 60
    };
    return state;
  };

  return {
    start() {
      return startAt(now);
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
      return startAt(at);
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

export const synchronizeSchedulerAtTime = (
  snapshot: SchedulerSnapshot,
  settings: AppSettings,
  at: Date
): SchedulerSnapshot => {
  if (
    snapshot.state === "idle" ||
    snapshot.state === "paused_today" ||
    snapshot.state === "break_active"
  ) {
    return snapshot;
  }

  const scheduleAtNow = createScheduler(settings, at).start();
  if (
    scheduleAtNow.state === "quiet_hours" ||
    scheduleAtNow.state === "outside_companion_hours"
  ) {
    return scheduleAtNow;
  }

  if (
    snapshot.state === "quiet_hours" ||
    snapshot.state === "outside_companion_hours"
  ) {
    return scheduleAtNow;
  }

  if (!snapshot.nextBreakAt) return snapshot;
  const nextBreakTimestamp = Date.parse(snapshot.nextBreakAt);
  if (Number.isNaN(nextBreakTimestamp)) return snapshot;

  return {
    ...snapshot,
    remainingSeconds: Math.max(0, Math.ceil((nextBreakTimestamp - at.getTime()) / 1000)),
    activeBreakSeconds: settings.breakMinutes * 60
  };
};
