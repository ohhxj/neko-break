import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";

export type MediaProbeResult = {
  durationSeconds: number;
  pixelWidth: number;
  pixelHeight: number;
};

const isMovFile = (filePath: string) => filePath.toLowerCase().endsWith(".mov");

const toProbeUrl = (filePath: string) => {
  if (filePath.startsWith("/") && isTauri()) {
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
          reject(new Error("This video could not be loaded. Try another transparent MOV file."));
        };

        video.src = toProbeUrl(filePath);
      });
