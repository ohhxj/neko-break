import type { OverlayPlaybackPhase } from "../../domain/breaks/types";
import type { MediaAsset, MediaFormat } from "../../domain/media/types";

export type OverlayDismissAction = "ignore" | "play_outro" | "close";
export type OverlayCountdownMode = "opening" | "compact" | "ending";

const COUNTDOWN_OPENING_SECONDS = 5;
const COUNTDOWN_ENDING_SECONDS = 5;

export const overlayCountdownMode = (
  remainingSeconds: number,
  totalSeconds: number
): OverlayCountdownMode => {
  if (remainingSeconds <= COUNTDOWN_ENDING_SECONDS) {
    return "ending";
  }

  const elapsedSeconds = Math.max(0, totalSeconds - remainingSeconds);
  return elapsedSeconds < COUNTDOWN_OPENING_SECONDS ? "opening" : "compact";
};

export const overlayDismissAction = (
  phase: OverlayPlaybackPhase,
  hasOutro: boolean,
  closeAlreadyRequested: boolean
): OverlayDismissAction => {
  if (closeAlreadyRequested || phase === "outro" || phase === "closing") {
    return "ignore";
  }
  return hasOutro ? "play_outro" : "close";
};

export const sceneClipsMatchFormat = (
  asset: MediaAsset | null | undefined,
  format: MediaFormat
) => Boolean(
  asset &&
  asset.loopClip.format === format &&
  (!asset.introClip || asset.introClip.format === format) &&
  (!asset.outroClip || asset.outroClip.format === format) &&
  (asset.interactions ?? []).every((interaction) => interaction.clip.format === format)
);
