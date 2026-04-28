import { describe, expect, it } from "vitest";
import { detectMediaFormat } from "../../src/domain/media/validation";

describe("detectMediaFormat", () => {
  it("classifies transparent webm and mov assets by extension", () => {
    expect(detectMediaFormat("/tmp/neko.webm")).toBe("webm_alpha");
    expect(detectMediaFormat("/tmp/neko.mov")).toBe("mov_alpha");
    expect(detectMediaFormat("/tmp/neko.mp4")).toBe("unknown");
  });
});
