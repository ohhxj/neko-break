export type OverlayStyle = "immersive" | "floating";

export type AppSettings = {
  intervalMinutes: number;
  breakMinutes: number;
  launchAtLogin: boolean;
  allowDelayOnce: boolean;
  allowPauseToday: boolean;
  defaultSceneId: string | null;
  overlayStyle: OverlayStyle;
};
