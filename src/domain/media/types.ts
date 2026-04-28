export type MediaFormat = "webm_alpha" | "mov_alpha" | "unknown";

export type MediaAsset = {
  id: string;
  name: string;
  filePath: string;
  format: MediaFormat;
  durationSeconds: number;
  hasTransparency: boolean;
  enabled: boolean;
  builtIn: boolean;
  copyTheme: string | null;
};
