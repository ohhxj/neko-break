import { describe, expect, it, vi } from "vitest";
import { createMediaStore } from "../../src/domain/media/store";
import { mergeAssets } from "../../src/domain/media/presets";
import { clipToScene } from "../../src/domain/media/types";

describe("createMediaStore", () => {
  it("loads imported media assets from the backend", async () => {
    const invoke = vi.fn().mockResolvedValue([
      {
        id: "asset-1",
        name: "Neko",
        filePath: "/tmp/neko.webm",
        previewImagePath: null,
        format: "webm_alpha",
        durationSeconds: 6,
        fileSizeBytes: 12000,
        pixelWidth: 1080,
        pixelHeight: 1080,
        hasTransparency: true,
        enabled: true,
        builtIn: false,
        copyTheme: null
      }
    ]);

    const store = createMediaStore(invoke);
    const assets = await store.load();

    expect(assets).toHaveLength(1);
    expect(assets[0]?.format).toBe("webm_alpha");
  });

  it("deletes a scene through the backend", async () => {
    const invoke = vi.fn().mockResolvedValue([]);
    const store = createMediaStore(invoke);

    await expect(store.deleteScene("scene-1")).resolves.toEqual([]);
    expect(invoke).toHaveBeenCalledWith("delete_scene", {
      sceneId: "scene-1"
    });
  });
});

describe("mergeAssets", () => {
  it("keeps incoming scene order so newer imported scenes stay at the end", () => {
    const scene = (id: string) =>
      clipToScene({
        id,
        name: id,
        filePath: "",
        previewImagePath: null,
        format: "webm_alpha",
        durationSeconds: 5,
        fileSizeBytes: 0,
        pixelWidth: 1920,
        pixelHeight: 1080,
        hasTransparency: true,
        enabled: true,
        builtIn: false,
        copyTheme: null
      });

    const merged = mergeAssets([scene("preset")], [scene("import-old"), scene("import-new")]);

    expect(merged.map((asset) => asset.id)).toEqual(["preset", "import-old", "import-new"]);
  });
});
