import { describe, expect, it } from "vitest";
import { createScheduler } from "../../src/domain/breaks/scheduler";
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
});
