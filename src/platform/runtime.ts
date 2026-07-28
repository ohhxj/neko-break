export type RuntimePlatform = "macos" | "windows" | "other";

const platformSource =
  typeof navigator === "undefined"
    ? ""
    : `${navigator.userAgent} ${navigator.platform}`.toLowerCase();

export const runtimePlatform: RuntimePlatform = platformSource.includes("windows")
  ? "windows"
  : platformSource.includes("mac")
    ? "macos"
    : "other";

export const isMacOSRuntime = runtimePlatform === "macos";
export const isWindowsRuntime = runtimePlatform === "windows";

export const isFileSystemPath = (filePath: string) => {
  if (
    filePath.startsWith("/assets/") ||
    filePath.startsWith("/src/") ||
    filePath.startsWith("/@vite/") ||
    filePath.startsWith("/@fs/")
  ) {
    return false;
  }
  return (
    filePath.startsWith("/") ||
    /^[a-zA-Z]:[\\/]/.test(filePath) ||
    filePath.startsWith("\\\\") ||
    filePath.startsWith("//")
  );
};
