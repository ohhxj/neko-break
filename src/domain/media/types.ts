export type MediaFormat = "webm_alpha" | "mov_alpha" | "apng_alpha" | "unknown";

export type SceneClip = {
  id: string;
  filePath: string;
  previewImagePath: string | null;
  format: MediaFormat;
  durationSeconds: number;
  fileSizeBytes: number;
  pixelWidth: number;
  pixelHeight: number;
  hasTransparency: boolean;
};

export type SceneInteraction = {
  id: string;
  name: string;
  clip: SceneClip;
};

export type SceneAsset = {
  id: string;
  name: string;
  filePath: string;
  previewImagePath: string | null;
  format: MediaFormat;
  durationSeconds: number;
  fileSizeBytes: number;
  pixelWidth: number;
  pixelHeight: number;
  hasTransparency: boolean;
  enabled: boolean;
  builtIn: boolean;
  copyTheme: string | null;
  coverImagePath: string | null;
  introClip: SceneClip | null;
  loopClip: SceneClip;
  outroClip: SceneClip | null;
  /** Optional one-shot actions available from the rest overlay's context menu. */
  interactions: SceneInteraction[];
  overlayStyleHint: "floating" | "immersive" | null;
  closeButtonLabel: string | null;
};

// Transitional alias so the current UI can keep compiling while we migrate surface-by-surface to SceneAsset.
export type MediaAsset = SceneAsset;

export const primaryClip = (scene: SceneAsset) => scene.loopClip;

export const clipToScene = (
  clip: Omit<SceneClip, "id"> & {
    id: string;
    name: string;
    enabled: boolean;
    builtIn: boolean;
    copyTheme: string | null;
  }
): SceneAsset => ({
  id: clip.id,
  name: clip.name,
  filePath: clip.filePath,
  previewImagePath: clip.previewImagePath,
  format: clip.format,
  durationSeconds: clip.durationSeconds,
  fileSizeBytes: clip.fileSizeBytes,
  pixelWidth: clip.pixelWidth,
  pixelHeight: clip.pixelHeight,
  hasTransparency: clip.hasTransparency,
  enabled: clip.enabled,
  builtIn: clip.builtIn,
  copyTheme: clip.copyTheme,
  coverImagePath: clip.previewImagePath,
  introClip: null,
  loopClip: {
    id: `${clip.id}-loop`,
    filePath: clip.filePath,
    previewImagePath: clip.previewImagePath,
    format: clip.format,
    durationSeconds: clip.durationSeconds,
    fileSizeBytes: clip.fileSizeBytes,
    pixelWidth: clip.pixelWidth,
    pixelHeight: clip.pixelHeight,
    hasTransparency: clip.hasTransparency
  },
  outroClip: null,
  interactions: [],
  overlayStyleHint: null,
  closeButtonLabel: null
});
