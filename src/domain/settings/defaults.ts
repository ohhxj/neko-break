import type { AppSettings } from "./types";

export const defaultSettings: AppSettings = {
  intervalMinutes: 90,
  breakMinutes: 5,
  launchAtLogin: true,
  allowDelayOnce: true,
  allowPauseToday: true,
  doNotDisturbEnabled: false,
  doNotDisturbStart: "12:00",
  doNotDisturbEnd: "13:30",
  companionEnabled: false,
  companionStart: "09:00",
  companionEnd: "22:00",
  defaultSceneId: null,
  overlayStyle: "immersive"
};
