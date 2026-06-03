import previewRagdollClean from "../../assets/media/covers/preview-ragdoll-clean.png";
import ragdollLoopCover from "../../assets/media/covers/ragdoll-loop.png";
import type { MediaAsset, SceneClip } from "./types";

// 真·透明 mov-alpha 预设：入场（站立→躺下）+ 循环（躺下呼吸）。
// 文件打包在 src-tauri/resources/presets/，运行时由 resolve_preset_path
// 解析成绝对路径后传入，走原生 AVPlayerLayer 双层无缝衔接。
export const RAGDOLL_PRESET_ID = "preset-ragdoll-standlie";

export const makeRagdollMovScene = (introPath: string, loopPath: string): MediaAsset => {
  const introClip: SceneClip = {
    id: `${RAGDOLL_PRESET_ID}-intro`,
    filePath: introPath,
    previewImagePath: previewRagdollClean,
    format: "mov_alpha",
    durationSeconds: 4.866667,
    fileSizeBytes: 5_169_961,
    pixelWidth: 1920,
    pixelHeight: 1080,
    hasTransparency: true
  };
  const loopClip: SceneClip = {
    id: `${RAGDOLL_PRESET_ID}-loop`,
    filePath: loopPath,
    previewImagePath: ragdollLoopCover,
    format: "mov_alpha",
    durationSeconds: 4.533333,
    fileSizeBytes: 3_549_161,
    pixelWidth: 1920,
    pixelHeight: 1080,
    hasTransparency: true
  };

  return {
    id: RAGDOLL_PRESET_ID,
    name: "布偶猫 · 站立躺下",
    filePath: loopClip.filePath,
    previewImagePath: ragdollLoopCover,
    format: "mov_alpha",
    durationSeconds: loopClip.durationSeconds,
    fileSizeBytes: loopClip.fileSizeBytes,
    pixelWidth: 1920,
    pixelHeight: 1080,
    hasTransparency: true,
    enabled: true,
    builtIn: true,
    copyTheme: null,
    coverImagePath: ragdollLoopCover,
    introClip,
    loopClip,
    outroClip: null,
    overlayStyleHint: null,
    closeButtonLabel: "小猫让开"
  };
};

// 旧的 webm 预设已移除：VP9-alpha 在 macOS WebView 无法透明合成（黑底），
// 现仅保留运行时注入的 mov-alpha 预设。
export const presetAssets: MediaAsset[] = [];

export const mergeAssets = (preset: MediaAsset[], imported: MediaAsset[]) => {
  const byId = new Map<string, MediaAsset>();
  [...preset, ...imported].forEach((asset) => {
    byId.set(asset.id, asset);
  });
  return [...byId.values()];
};
