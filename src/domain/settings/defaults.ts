import type { AppSettings } from "./types";

export const defaultSettings: AppSettings = {
  intervalMinutes: 90,
  breakMinutes: 5,
  launchAtLogin: true,
  allowDelayOnce: true,
  allowPauseToday: true,
  defaultSceneId: null,
  overlayStyle: "floating"
};
