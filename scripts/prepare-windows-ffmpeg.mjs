import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat
} from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = path.join(projectRoot, "scripts", "ffmpeg-windows.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const cacheDir = path.join(projectRoot, ".cache", "ffmpeg");
const archivePath = path.join(cacheDir, manifest.archiveName);
const outputDir = path.join(projectRoot, "src-tauri", "resources", "bin");
const ffmpegOutput = path.join(outputDir, "ffmpeg.exe");
const licenseOutput = path.join(outputDir, "FFmpeg-LICENSE.txt");
const noticeSource = path.join(projectRoot, "THIRD_PARTY_NOTICES.md");
const noticeOutput = path.join(outputDir, "FFmpeg-NOTICE.txt");

const sha256 = async (filePath) => {
  const hash = createHash("sha256");
  await pipeline(createReadStream(filePath), hash);
  return hash.digest("hex");
};

const matchesHash = async (filePath, expected) => {
  try {
    return (await stat(filePath)).isFile() && (await sha256(filePath)) === expected;
  } catch {
    return false;
  }
};

const download = async () => {
  const temporaryPath = `${archivePath}.part-${process.pid}`;
  await rm(temporaryPath, { force: true });
  const curl = process.platform === "win32" ? "curl.exe" : "curl";
  const result = spawnSync(
    curl,
    ["-L", "--fail", "--silent", "--show-error", manifest.url, "-o", temporaryPath],
    { stdio: "inherit" }
  );
  if (result.status !== 0) throw new Error("FFmpeg download failed.");
  const digest = await sha256(temporaryPath);
  if (digest !== manifest.archiveSha256) {
    await rm(temporaryPath, { force: true });
    throw new Error(`FFmpeg archive checksum mismatch: expected ${manifest.archiveSha256}, got ${digest}`);
  }
  await rm(archivePath, { force: true });
  await rename(temporaryPath, archivePath);
};

const extractArchive = async (destination) => {
  if (process.platform === "win32") {
    const quote = (value) => `'${value.replaceAll("'", "''")}'`;
    const command = `Expand-Archive -LiteralPath ${quote(archivePath)} -DestinationPath ${quote(destination)} -Force`;
    const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
      stdio: "inherit"
    });
    if (result.status !== 0) throw new Error("PowerShell could not extract the FFmpeg archive.");
    return;
  }

  const result = spawnSync(
    "unzip",
    ["-qq", "-j", archivePath, "*/bin/ffmpeg.exe", "*/LICENSE.txt", "-d", destination],
    { stdio: "inherit" }
  );
  if (result.status !== 0) throw new Error("The unzip command could not extract the FFmpeg archive.");
};

const findFile = async (directory, filename) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isFile() && entry.name === filename) return entryPath;
    if (entry.isDirectory()) {
      const nested = await findFile(entryPath, filename);
      if (nested) return nested;
    }
  }
  return null;
};

await mkdir(outputDir, { recursive: true });
await copyFile(noticeSource, noticeOutput);

if (
  (await matchesHash(ffmpegOutput, manifest.ffmpegSha256)) &&
  (await matchesHash(licenseOutput, manifest.licenseSha256))
) {
  console.log(`FFmpeg ${manifest.release} is already prepared.`);
  process.exit(0);
}

await mkdir(cacheDir, { recursive: true });
if (!(await matchesHash(archivePath, manifest.archiveSha256))) {
  console.log(`Downloading pinned LGPL FFmpeg build ${manifest.release}…`);
  await download();
}

const extractionDir = path.join(cacheDir, `extract-${process.pid}-${Date.now()}`);
await mkdir(extractionDir, { recursive: true });
try {
  await extractArchive(extractionDir);
  const extractedFfmpeg = await findFile(extractionDir, "ffmpeg.exe");
  const extractedLicense = await findFile(extractionDir, "LICENSE.txt");
  if (!extractedFfmpeg || !extractedLicense) {
    throw new Error("The FFmpeg archive does not contain ffmpeg.exe and LICENSE.txt.");
  }
  if (!(await matchesHash(extractedFfmpeg, manifest.ffmpegSha256))) {
    throw new Error("Extracted ffmpeg.exe checksum mismatch.");
  }
  if (!(await matchesHash(extractedLicense, manifest.licenseSha256))) {
    throw new Error("Extracted FFmpeg license checksum mismatch.");
  }

  const ffmpegTemporary = `${ffmpegOutput}.part-${process.pid}`;
  const licenseTemporary = `${licenseOutput}.part-${process.pid}`;
  await copyFile(extractedFfmpeg, ffmpegTemporary);
  await copyFile(extractedLicense, licenseTemporary);
  await rm(ffmpegOutput, { force: true });
  await rm(licenseOutput, { force: true });
  await rename(ffmpegTemporary, ffmpegOutput);
  await rename(licenseTemporary, licenseOutput);
} finally {
  await rm(extractionDir, { recursive: true, force: true });
}

console.log(`Prepared FFmpeg ${manifest.release} at ${path.relative(projectRoot, ffmpegOutput)}.`);
