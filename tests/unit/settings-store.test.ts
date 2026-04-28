import { describe, expect, it, vi } from "vitest";
import { defaultSettings } from "../../src/domain/settings/defaults";
import { createSettingsStore } from "../../src/domain/settings/store";

describe("defaultSettings", () => {
  it("uses a 90 minute interval and a 5 minute break by default", () => {
    expect(defaultSettings.intervalMinutes).toBe(90);
    expect(defaultSettings.breakMinutes).toBe(5);
    expect(defaultSettings.launchAtLogin).toBe(true);
    expect(defaultSettings.allowDelayOnce).toBe(true);
  });
});

describe("createSettingsStore", () => {
  it("loads defaults when no persisted settings exist", async () => {
    const invoke = vi.fn().mockResolvedValue(defaultSettings);
    const store = createSettingsStore(invoke);

    const settings = await store.load();
    expect(settings.intervalMinutes).toBe(90);
  });
});
