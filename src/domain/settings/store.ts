import { defaultSettings } from "./defaults";
import type { AppSettings } from "./types";

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export const createSettingsStore = (invoke: Invoke) => ({
  async load(): Promise<AppSettings> {
    return invoke<AppSettings>("load_settings").catch(() => defaultSettings);
  },
  async save(settings: AppSettings): Promise<AppSettings> {
    return invoke<AppSettings>("save_settings", { settings }).catch(() => settings);
  }
});
