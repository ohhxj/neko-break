import { describe, expect, it } from "vitest";
import {
  overlayCountdownMode,
  overlayDismissAction
} from "../../src/features/overlay/playback";

describe("overlayCountdownMode", () => {
  it("shows the full card for the first five seconds", () => {
    expect(overlayCountdownMode(60, 60)).toBe("opening");
    expect(overlayCountdownMode(56, 60)).toBe("opening");
  });

  it("uses the compact state during the middle of a break", () => {
    expect(overlayCountdownMode(55, 60)).toBe("compact");
    expect(overlayCountdownMode(6, 60)).toBe("compact");
  });

  it("restores the emphasized card for the final five seconds", () => {
    expect(overlayCountdownMode(5, 60)).toBe("ending");
    expect(overlayCountdownMode(0, 60)).toBe("ending");
  });
});

describe("overlayDismissAction", () => {
  it("starts the outro from either intro or loop with one request", () => {
    expect(overlayDismissAction("intro", true, false)).toBe("play_outro");
    expect(overlayDismissAction("loop", true, false)).toBe("play_outro");
  });

  it("ignores repeated requests while outro or closing is underway", () => {
    expect(overlayDismissAction("loop", true, true)).toBe("ignore");
    expect(overlayDismissAction("outro", true, true)).toBe("ignore");
    expect(overlayDismissAction("closing", true, true)).toBe("ignore");
  });

  it("closes immediately when the scene has no outro", () => {
    expect(overlayDismissAction("intro", false, false)).toBe("close");
    expect(overlayDismissAction("loop", false, false)).toBe("close");
  });
});
