import type { MediaAsset } from "./types";

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export const createMediaStore = (invoke: Invoke) => ({
  async load(): Promise<MediaAsset[]> {
    return invoke<MediaAsset[]>("load_media").catch(() => []);
  },
  async import(filePath: string): Promise<MediaAsset> {
    return invoke<MediaAsset>("import_media", { filePath });
  }
});
