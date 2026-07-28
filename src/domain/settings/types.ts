export type OverlayStyle = "immersive" | "floating";

export type AppSettings = {
  intervalMinutes: number;
  breakMinutes: number;
  launchAtLogin: boolean;
  allowDelayOnce: boolean;
  allowPauseToday: boolean;
  doNotDisturbEnabled: boolean;
  doNotDisturbStart: string;
  doNotDisturbEnd: string;
  companionEnabled: boolean;
  companionStart: string;
  companionEnd: string;
  defaultSceneId: string | null;
  overlayStyle: OverlayStyle;
};
