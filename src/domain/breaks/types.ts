import type { MediaAsset } from "../media/types";
import type { OverlayStyle } from "../settings/types";

export type BreakState =
  | "idle"
  | "counting"
  | "break_active"
  | "delayed"
  | "paused_today";

export type SchedulerSnapshot = {
  state: BreakState;
  nextBreakAt: string | null;
  remainingSeconds: number;
  activeBreakSeconds: number;
};

export type OverlayPayload = {
  asset: MediaAsset | null;
  remainingSeconds: number;
  message: string;
  style: OverlayStyle;
  sessionId: number;
};

export type OverlayPlaybackPhase = "intro" | "loop" | "outro" | "closing";
