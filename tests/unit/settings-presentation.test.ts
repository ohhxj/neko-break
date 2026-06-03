import { describe, expect, it } from "vitest";
import {
  overlayStyleDescription,
  overlayStyleLabel
} from "../../src/domain/settings/presentation";

describe("overlayStyleLabel", () => {
  it("returns a readable label for floating mode", () => {
    expect(overlayStyleLabel("floating")).toBe("可爱弹窗");
  });
});

describe("overlayStyleDescription", () => {
  it("describes immersive mode as a stronger full-screen break", () => {
    expect(overlayStyleDescription("immersive")).toContain("沉浸式");
  });
});
