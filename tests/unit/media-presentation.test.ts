import { describe, expect, it } from "vitest";
import {
  assetSourceLabel,
  fileSizeLabel,
  resolutionLabel,
  transparencyLabel
} from "../../src/domain/media/presentation";
import { clipToScene } from "../../src/domain/media/types";

describe("fileSizeLabel", () => {
  it("returns the built-in label for zero-sized preset assets", () => {
    expect(fileSizeLabel(0)).toBe("内置");
  });

  it("formats megabyte values for imported files", () => {
    expect(fileSizeLabel(2_600_000)).toBe("2.5 MB");
  });
});

describe("resolutionLabel", () => {
  it("formats pixel dimensions", () => {
    expect(resolutionLabel(1080, 1920)).toBe("1080 x 1920");
  });
});

describe("transparencyLabel", () => {
  it("describes assets with alpha as expected transparent media", () => {
    expect(
      transparencyLabel(clipToScene({
        id: "asset-1",
        name: "Cat",
        filePath: "",
        previewImagePath: null,
        format: "webm_alpha",
        durationSeconds: 8,
        fileSizeBytes: 0,
        pixelWidth: 1080,
        pixelHeight: 1920,
        hasTransparency: true,
        enabled: true,
        builtIn: true,
        copyTheme: null
      }))
    ).toBe("透明背景");
  });
});

describe("assetSourceLabel", () => {
  it("tells built-in presets apart from imported files", () => {
    expect(
      assetSourceLabel(clipToScene({
        id: "asset-1",
        name: "Cat",
        filePath: "",
        previewImagePath: null,
        format: "webm_alpha",
        durationSeconds: 8,
        fileSizeBytes: 0,
        pixelWidth: 1080,
        pixelHeight: 1920,
        hasTransparency: true,
        enabled: true,
        builtIn: false,
        copyTheme: null
      }))
    ).toBe("我的导入");
  });
});
