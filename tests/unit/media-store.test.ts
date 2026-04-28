import { describe, expect, it, vi } from "vitest";
import { createMediaStore } from "../../src/domain/media/store";

describe("createMediaStore", () => {
  it("loads imported media assets from the backend", async () => {
    const invoke = vi.fn().mockResolvedValue([
      {
        id: "asset-1",
        name: "Neko",
        filePath: "/tmp/neko.webm",
        format: "webm_alpha",
        durationSeconds: 6,
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
});
