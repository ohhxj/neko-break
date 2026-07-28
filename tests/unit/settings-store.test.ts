import { describe, expect, it, vi } from "vitest";
import { defaultSettings } from "../../src/domain/settings/defaults";
import { createSettingsStore } from "../../src/domain/settings/store";

describe("defaultSettings", () => {
  it("uses a 90 minute interval and a 5 minute break by default", () => {
    expect(defaultSettings.intervalMinutes).toBe(90);
    expect(defaultSettings.breakMinutes).toBe(5);
    expect(defaultSettings.launchAtLogin).toBe(true);
    expect(defaultSettings.allowDelayOnce).toBe(true);
    expect(defaultSettings.overlayStyle).toBe("immersive");
    expect(defaultSettings.doNotDisturbEnabled).toBe(false);
    expect(defaultSettings.doNotDisturbStart).toBe("12:00");
    expect(defaultSettings.doNotDisturbEnd).toBe("13:30");
  });
});

describe("createSettingsStore", () => {
  it("loads defaults when no persisted settings exist", async () => {
    const invoke = vi.fn().mockResolvedValue(defaultSettings);
    const store = createSettingsStore(invoke);

    const settings = await store.load();
    expect(settings.intervalMinutes).toBe(90);
  });

  it("restores hidden pause and delay capabilities when loading legacy disabled settings", async () => {
    const invoke = vi.fn().mockResolvedValue({
      ...defaultSettings,
      allowDelayOnce: false,
      allowPauseToday: false
    });
    const store = createSettingsStore(invoke);

    const settings = await store.load();

    expect(settings.allowDelayOnce).toBe(true);
    expect(settings.allowPauseToday).toBe(true);
  });

  it("restores do-not-disturb defaults when loading legacy settings", async () => {
    const invoke = vi.fn().mockResolvedValue({
      intervalMinutes: 90,
      breakMinutes: 5,
      launchAtLogin: true,
      allowDelayOnce: true,
      allowPauseToday: true,
      defaultSceneId: null,
      overlayStyle: "floating"
    });
    const store = createSettingsStore(invoke);

    const settings = await store.load();

    expect(settings.doNotDisturbEnabled).toBe(false);
    expect(settings.doNotDisturbStart).toBe("12:00");
    expect(settings.doNotDisturbEnd).toBe("13:30");
  });

  it("saves launch-at-login changes", async () => {
    const invoke = vi.fn().mockResolvedValue({
      ...defaultSettings,
      launchAtLogin: false
    });
    const store = createSettingsStore(invoke);

    const settings = await store.save({
      ...defaultSettings,
      launchAtLogin: false
    });

    expect(settings.launchAtLogin).toBe(false);
  });

  it("saves the selected overlay style", async () => {
    const invoke = vi.fn().mockResolvedValue({
      ...defaultSettings,
        overlayStyle: "floating"
    });
    const store = createSettingsStore(invoke);

    const settings = await store.save({
      ...defaultSettings,
      overlayStyle: "floating"
    });

    expect(settings.overlayStyle).toBe("floating");
  });

  it("persists hidden pause and delay capabilities as enabled", async () => {
    const invoke = vi.fn().mockResolvedValue({
      ...defaultSettings,
      allowDelayOnce: true,
      allowPauseToday: true
    });
    const store = createSettingsStore(invoke);

    await store.save({
      ...defaultSettings,
      allowDelayOnce: false,
      allowPauseToday: false
    });

    expect(invoke).toHaveBeenCalledWith("save_settings", {
      settings: {
        ...defaultSettings,
        allowDelayOnce: true,
        allowPauseToday: true
      }
    });
  });
});
