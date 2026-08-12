import type { MediaAsset } from "../media/types";
import type { BreakRecord } from "../break-history/types";
import type { OverlayStyle } from "../settings/types";

export type BreakState =
  | "idle"
  | "counting"
  | "break_active"
  | "delayed"
  | "quiet_hours"
  | "outside_companion_hours"
  | "paused_today";

export type SchedulerSnapshot = {
  state: BreakState;
  nextBreakAt: string | null;
  /** Absolute end time for an active break; keeps countdowns correct after system sleep. */
  breakEndsAt?: string | null;
  remainingSeconds: number;
  activeBreakSeconds: number;
};

export type OverlayPayload = {
  asset: MediaAsset | null;
  remainingSeconds: number;
  message: string;
  style: OverlayStyle;
  sessionId: number;
  trackOutcome: boolean;
};

export type BreakOutcomePayload = BreakRecord;

export type OverlayPlaybackPhase = "intro" | "loop" | "outro" | "closing";
