import type { MediaAsset, SceneClip } from "./types";

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export const createMediaStore = (invoke: Invoke) => ({
  async load(): Promise<MediaAsset[]> {
    return invoke<MediaAsset[]>("load_media").catch(() => []);
  },
  async import(
    filePath: string,
    durationSeconds: number,
    pixelWidth: number,
    pixelHeight: number
  ): Promise<MediaAsset> {
    return invoke<MediaAsset>("import_media", {
      filePath,
      durationSeconds,
      pixelWidth,
      pixelHeight
    });
  },
  async importClip(
    filePath: string,
    durationSeconds: number,
    pixelWidth: number,
    pixelHeight: number
  ): Promise<SceneClip> {
    return invoke<SceneClip>("import_clip", {
      filePath,
      durationSeconds,
      pixelWidth,
      pixelHeight
    });
  },
  async saveScene(scene: MediaAsset): Promise<MediaAsset> {
    return invoke<MediaAsset>("save_scene", {
      scene
    });
  },
  async deleteScene(sceneId: string): Promise<MediaAsset[]> {
    return invoke<MediaAsset[]>("delete_scene", {
      sceneId
    });
  }
});
