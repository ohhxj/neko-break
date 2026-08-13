import { describe, expect, it } from "vitest";
import {
  overlayCountdownMode,
  overlayDismissAction,
  sceneClipsMatchFormat
} from "../../src/features/overlay/playback";
import type { MediaAsset, MediaFormat } from "../../src/domain/media/types";

const sceneWithFormats = (loop: MediaFormat, interactions: MediaFormat[]): MediaAsset => ({
  loopClip: { format: loop },
  introClip: null,
  outroClip: null,
  interactions: interactions.map((format, index) => ({
    id: `interaction-${index}`,
    name: `Interaction ${index}`,
    clip: { format }
  }))
} as MediaAsset);

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

describe("sceneClipsMatchFormat", () => {
  it("keeps seamless playback enabled when interactions use the same format", () => {
    expect(sceneClipsMatchFormat(sceneWithFormats("webm_alpha", ["webm_alpha"]), "webm_alpha")).toBe(true);
    expect(sceneClipsMatchFormat(sceneWithFormats("mov_alpha", ["mov_alpha"]), "mov_alpha")).toBe(true);
  });

  it("rejects a mixed-format interaction stack", () => {
    expect(sceneClipsMatchFormat(sceneWithFormats("mov_alpha", ["webm_alpha"]), "mov_alpha")).toBe(false);
  });
});
