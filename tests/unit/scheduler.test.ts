import { describe, expect, it } from "vitest";
import {
  createScheduler,
  synchronizeSchedulerAtTime
} from "../../src/domain/breaks/scheduler";
import { defaultSettings } from "../../src/domain/settings/defaults";

describe("createScheduler", () => {
  it("creates the next break timestamp from the configured interval", () => {
    const scheduler = createScheduler(defaultSettings, new Date("2026-04-28T09:00:00.000Z"));
    const snapshot = scheduler.start();

    expect(snapshot.state).toBe("counting");
    expect(snapshot.nextBreakAt).toBe("2026-04-28T10:30:00.000Z");
  });

  it("transitions into a break and then back into counting", () => {
    const scheduler = createScheduler(defaultSettings, new Date("2026-04-28T09:00:00.000Z"));
    scheduler.start();

    const active = scheduler.triggerBreak();
    expect(active.state).toBe("break_active");
    expect(active.remainingSeconds).toBe(300);

    const resumed = scheduler.finishBreak(new Date("2026-04-28T09:05:00.000Z"));
    expect(resumed.state).toBe("counting");
    expect(resumed.nextBreakAt).toBe("2026-04-28T10:35:00.000Z");
  });

  it("pauses automatic reminders during do-not-disturb time", () => {
    const scheduler = createScheduler(
      {
        ...defaultSettings,
        doNotDisturbEnabled: true,
        doNotDisturbStart: "12:00",
        doNotDisturbEnd: "13:30"
      },
      new Date(2026, 3, 28, 12, 15)
    );

    const snapshot = scheduler.start();

    expect(snapshot.state).toBe("quiet_hours");
    expect(snapshot.nextBreakAt).toBe(new Date(2026, 3, 28, 13, 30).toISOString());
    expect(snapshot.remainingSeconds).toBe(75 * 60);
  });

  it("starts a full interval after do-not-disturb time ends", () => {
    const scheduler = createScheduler(
      {
        ...defaultSettings,
        doNotDisturbEnabled: true,
        doNotDisturbStart: "12:00",
        doNotDisturbEnd: "13:30"
      },
      new Date(2026, 3, 28, 13, 30)
    );

    const snapshot = scheduler.start();

    expect(snapshot.state).toBe("counting");
    expect(snapshot.nextBreakAt).toBe(new Date(2026, 3, 28, 15, 0).toISOString());
    expect(snapshot.remainingSeconds).toBe(90 * 60);
  });

  it("waits until companion time begins before starting reminders", () => {
    const scheduler = createScheduler(
      {
        ...defaultSettings,
        companionEnabled: true,
        companionStart: "09:00",
        companionEnd: "22:00"
      },
      new Date(2026, 3, 28, 7, 30)
    );

    const snapshot = scheduler.start();

    expect(snapshot.state).toBe("outside_companion_hours");
    expect(snapshot.nextBreakAt).toBe(new Date(2026, 3, 28, 9, 0).toISOString());
    expect(snapshot.remainingSeconds).toBe(90 * 60);
  });

  it("supports companion windows that cross midnight", () => {
    const scheduler = createScheduler(
      {
        ...defaultSettings,
        companionEnabled: true,
        companionStart: "22:00",
        companionEnd: "07:00"
      },
      new Date(2026, 3, 28, 23, 0)
    );

    const snapshot = scheduler.start();

    expect(snapshot.state).toBe("counting");
    expect(snapshot.nextBreakAt).toBe(new Date(2026, 3, 29, 0, 30).toISOString());
  });

  it("starts a fresh interval after waking inside companion time", () => {
    const settings = {
      ...defaultSettings,
      intervalMinutes: 15,
      companionEnabled: true,
      companionStart: "09:00",
      companionEnd: "20:00"
    };
    const waiting = createScheduler(settings, new Date(2026, 6, 21, 20, 30)).start();

    const synchronized = synchronizeSchedulerAtTime(
      waiting,
      settings,
      new Date(2026, 6, 22, 11, 0)
    );

    expect(waiting.state).toBe("outside_companion_hours");
    expect(synchronized.state).toBe("counting");
    expect(synchronized.remainingSeconds).toBe(15 * 60);
    expect(synchronized.nextBreakAt).toBe(new Date(2026, 6, 22, 11, 15).toISOString());
  });

  it("uses the absolute deadline after a sleeping timer resumes", () => {
    const settings = {
      ...defaultSettings,
      companionEnabled: true,
      companionStart: "09:00",
      companionEnd: "20:00"
    };
    const waiting = createScheduler(settings, new Date(2026, 6, 22, 7, 30)).start();

    const synchronized = synchronizeSchedulerAtTime(
      waiting,
      settings,
      new Date(2026, 6, 22, 8, 45)
    );

    expect(synchronized.state).toBe("outside_companion_hours");
    expect(synchronized.remainingSeconds).toBe(15 * 60);
  });
});
