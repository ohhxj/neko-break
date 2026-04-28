import type { MediaAsset } from "./types";

export const assetLabel = (asset: MediaAsset) =>
  `${asset.name} · ${asset.format} · ${Math.round(asset.durationSeconds)}s`;
