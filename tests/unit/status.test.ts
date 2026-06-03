import { describe, expect, it } from "vitest";
import {
  countdownLabel,
  schedulerStateLabel,
  statusLabel,
  trayTitleLabel,
  trayPauseMenuLabel,
  trayTooltipLabel
} from "../../src/features/menu-bar/status";

describe("statusLabel", () => {
  it("formats the next break time for counting mode", () => {
    expect(
      statusLabel({
        state: "counting",
        nextBreakAt: "2026-04-28T10:30:00.000Z",
        remainingSeconds: 120,
        activeBreakSeconds: 300
      })
    ).toContain("Next break at");
  });
});

describe("countdownLabel", () => {
  it("formats seconds as mm:ss", () => {
    expect(countdownLabel(65)).toBe("01:05");
  });
});

describe("trayTooltipLabel", () => {
  it("describes paused state for the tray tooltip", () => {
    expect(
      trayTooltipLabel({
        state: "paused_today",
        nextBreakAt: null,
        remainingSeconds: 0,
        activeBreakSeconds: 300
      })
    ).toContain("暂停");
  });
});

describe("trayPauseMenuLabel", () => {
  it("switches to resume when the scheduler is paused", () => {
    expect(trayPauseMenuLabel("paused_today")).toBe("恢复提醒");
  });
});

describe("trayTitleLabel", () => {
  it("shows live countdown while a break is active", () => {
    expect(
      trayTitleLabel({
        state: "break_active",
        nextBreakAt: null,
        remainingSeconds: 125,
        activeBreakSeconds: 300
      })
    ).toBe("休息 02:05");
  });
});

describe("schedulerStateLabel", () => {
  it("maps internal state names to readable copy", () => {
    expect(schedulerStateLabel("delayed")).toBe("已延后一次");
  });
});
