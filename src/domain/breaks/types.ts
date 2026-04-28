import type { MediaAsset } from "../media/types";

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
};
