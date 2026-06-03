import { describe, expect, it } from "vitest";
import { reconcileSchedulerAfterSettingsChange } from "../../src/domain/breaks/reconcile";
import { defaultSettings } from "../../src/domain/settings/defaults";

describe("reconcileSchedulerAfterSettingsChange", () => {
  it("restarts counting when interval settings change", () => {
    const next = reconcileSchedulerAfterSettingsChange(
      {
        state: "counting",
        nextBreakAt: "2026-04-28T10:30:00.000Z",
        remainingSeconds: 1200,
        activeBreakSeconds: 300
      },
      defaultSettings,
      { ...defaultSettings, intervalMinutes: 60 },
      true,
      new Date("2026-04-28T09:00:00.000Z")
    );

    expect(next.state).toBe("counting");
    expect(next.remainingSeconds).toBe(3600);
    expect(next.nextBreakAt).toBe("2026-04-28T10:00:00.000Z");
  });

  it("keeps an active break running while updating the planned break length", () => {
    const next = reconcileSchedulerAfterSettingsChange(
      {
        state: "break_active",
        nextBreakAt: null,
        remainingSeconds: 90,
        activeBreakSeconds: 300
      },
      defaultSettings,
      { ...defaultSettings, breakMinutes: 7 },
      true,
      new Date("2026-04-28T09:00:00.000Z")
    );

    expect(next.state).toBe("break_active");
    expect(next.remainingSeconds).toBe(90);
    expect(next.activeBreakSeconds).toBe(420);
  });

  it("resumes scheduling if pause-today gets disabled while paused", () => {
    const next = reconcileSchedulerAfterSettingsChange(
      {
        state: "paused_today",
        nextBreakAt: null,
        remainingSeconds: 0,
        activeBreakSeconds: 300
      },
      defaultSettings,
      { ...defaultSettings, allowPauseToday: false },
      true,
      new Date("2026-04-28T09:00:00.000Z")
    );

    expect(next.state).toBe("counting");
    expect(next.remainingSeconds).toBe(5400);
  });
});
