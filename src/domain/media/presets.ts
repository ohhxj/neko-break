import type { MediaAsset } from "./types";

export const presetAssets: MediaAsset[] = [
  {
    id: "preset-neko",
    name: "Preset Neko",
    filePath: "",
    format: "webm_alpha",
    durationSeconds: 8,
    hasTransparency: true,
    enabled: true,
    builtIn: true,
    copyTheme: "Stretch and breathe."
  }
];

export const mergeAssets = (preset: MediaAsset[], imported: MediaAsset[]) => {
  const byId = new Map<string, MediaAsset>();
  [...preset, ...imported].forEach((asset) => {
    byId.set(asset.id, asset);
  });
  return [...byId.values()];
};
