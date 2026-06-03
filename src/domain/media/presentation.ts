import type { MediaAsset } from "./types";

export const assetLabel = (asset: MediaAsset) =>
  `${asset.name} · ${asset.format} · ${Math.round(asset.durationSeconds)} 秒`;

export const fileSizeLabel = (bytes: number) => {
  if (bytes <= 0) return "内置";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const resolutionLabel = (width: number, height: number) => {
  if (width <= 0 || height <= 0) return "分辨率未知";
  return `${width} x ${height}`;
};

export const transparencyLabel = (asset: MediaAsset) =>
  asset.hasTransparency ? "透明背景" : "透明性未知";

export const assetSourceLabel = (asset: MediaAsset) =>
  asset.builtIn ? "内置推荐" : "我的导入";

export const assetPresetHint = (asset: MediaAsset) =>
  asset.builtIn ? "打开就能直接用" : "这是你自己添加的场景素材";
