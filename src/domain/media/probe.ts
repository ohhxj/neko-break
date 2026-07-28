import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";
import { isFileSystemPath } from "../../platform/runtime";

export type MediaProbeResult = {
  durationSeconds: number;
  pixelWidth: number;
  pixelHeight: number;
};

const isMovFile = (filePath: string) => filePath.toLowerCase().endsWith(".mov");

const toProbeUrl = (filePath: string) => {
  if (isFileSystemPath(filePath) && isTauri()) {
    return convertFileSrc(filePath);
  }
  return filePath;
};

export const probeMediaFile = async (filePath: string): Promise<MediaProbeResult> =>
  isMovFile(filePath) && isTauri()
    ? invoke<MediaProbeResult>("probe_media", { filePath })
    : new Promise((resolve, reject) => {
        const video = document.createElement("video");
        const timeout = window.setTimeout(() => {
          cleanup();
          reject(new Error("Timed out while reading video metadata."));
        }, 5000);

        const cleanup = () => {
          window.clearTimeout(timeout);
          video.removeAttribute("src");
          video.load();
        };

        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;

        video.onloadedmetadata = () => {
          const duration = Number.isFinite(video.duration) ? video.duration : 0;
          cleanup();
          if (duration <= 0) {
            reject(new Error("This video did not report a usable duration."));
            return;
          }
          resolve({
            durationSeconds: duration,
            pixelWidth: video.videoWidth,
            pixelHeight: video.videoHeight
          });
        };

        video.onerror = () => {
          cleanup();
          reject(new Error("无法读取这段视频，请确认素材格式和文件是否完整。"));
        };

        video.src = toProbeUrl(filePath);
      });

export const captureVideoPoster = (filePath: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("提取素材封面超时，请换一段 WebM 后重试。"));
    }, 8000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.pause();
      video.removeAttribute("src");
      video.load();
    };

    const capture = () => {
      try {
        const sourceWidth = video.videoWidth;
        const sourceHeight = video.videoHeight;
        if (!sourceWidth || !sourceHeight) {
          throw new Error("素材没有可读取的画面尺寸。");
        }
        const scale = Math.min(1, 720 / sourceWidth);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(sourceWidth * scale));
        canvas.height = Math.max(1, Math.round(sourceHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("无法创建封面画布。");
        }
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/png");
        cleanup();
        resolve(dataUrl);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.onloadeddata = () => {
      const targetTime = Math.min(0.5, Math.max(0, video.duration / 4));
      if (targetTime <= 0.01) {
        capture();
        return;
      }
      video.onseeked = capture;
      video.currentTime = targetTime;
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("无法从这段 WebM 中提取封面。"));
    };
    video.src = toProbeUrl(filePath);
  });
