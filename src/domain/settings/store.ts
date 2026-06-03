import { defaultSettings } from "./defaults";
import type { AppSettings } from "./types";

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

const withAlwaysAllowedActions = (settings: AppSettings): AppSettings => ({
  ...settings,
  allowDelayOnce: true,
  allowPauseToday: true
});

export const createSettingsStore = (invoke: Invoke) => ({
  async load(): Promise<AppSettings> {
    return invoke<AppSettings>("load_settings")
      .then(withAlwaysAllowedActions)
      .catch(() => defaultSettings);
  },
  async save(settings: AppSettings): Promise<AppSettings> {
    const normalizedSettings = withAlwaysAllowedActions(settings);
    return invoke<AppSettings>("save_settings", { settings: normalizedSettings })
      .then(withAlwaysAllowedActions)
      .catch(() => normalizedSettings);
  }
});
