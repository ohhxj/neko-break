import type { MediaFormat } from "./types";

export const detectMediaFormat = (filePath: string): MediaFormat => {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".webm")) return "webm_alpha";
  if (lower.endsWith(".mov")) return "mov_alpha";
  return "unknown";
};
