import { describe, expect, it } from "vitest";
import { isFileSystemPath } from "../../src/platform/runtime";

describe("runtime filesystem paths", () => {
  it("recognizes Unix, Windows drive, and UNC paths", () => {
    expect(isFileSystemPath("/Users/neko/scene.mov")).toBe(true);
    expect(isFileSystemPath("C:\\Users\\neko\\scene.webm")).toBe(true);
    expect(isFileSystemPath("D:/Scenes/cat-loop.webm")).toBe(true);
    expect(isFileSystemPath("\\\\studio-nas\\scenes\\cat-loop.webm")).toBe(true);
  });

  it("keeps bundled and remote URLs unchanged", () => {
    expect(isFileSystemPath("/assets/cat-loop.webm")).toBe(false);
    expect(isFileSystemPath("https://example.com/cat-loop.webm")).toBe(false);
    expect(isFileSystemPath("blob:https://example.com/preview")).toBe(false);
  });
});
