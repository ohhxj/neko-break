import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { createSettingsStore } from "../domain/settings/store";
import { defaultSettings } from "../domain/settings/defaults";
import type { AppSettings } from "../domain/settings/types";
import type { MediaAsset } from "../domain/media/types";
import type { SchedulerSnapshot } from "../domain/breaks/types";
import { createRouterSnapshot } from "./router";
import { SetupScreen } from "../features/setup/SetupScreen";
import { DashboardScreen } from "../features/dashboard/DashboardScreen";
import { SettingsScreen } from "../features/settings/SettingsScreen";
import { MediaLibraryScreen } from "../features/media-library/MediaLibraryScreen";
import { BreakOverlay } from "../features/overlay/BreakOverlay";
import { statusLabel } from "../features/menu-bar/status";

const settingsStore = createSettingsStore(invoke);

const initialScheduler: SchedulerSnapshot = {
  state: "idle",
  nextBreakAt: null,
  remainingSeconds: 0,
  activeBreakSeconds: defaultSettings.breakMinutes * 60
};

const demoAssets: MediaAsset[] = [
  {
    id: "preset-neko",
    name: "Preset Neko",
    filePath: "",
    format: "webm_alpha",
    durationSeconds: 8,
    hasTransparency: true,
    enabled: true,
    builtIn: true,
    copyTheme: "Stretch and breathe."
  }
];

export function App() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>(demoAssets);
  const [scheduler, setScheduler] = useState<SchedulerSnapshot>(initialScheduler);
  const [setupComplete, setSetupComplete] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  useEffect(() => {
    void settingsStore.load().then((loaded) => {
      setSettings(loaded);
      setSelectedAssetId(loaded.defaultAssetId);
      setSetupComplete(Boolean(loaded.defaultAssetId));
    }).catch(() => {
      setSettings(defaultSettings);
    });
  }, []);

  if (!settings) {
    return <main className="shell"><p>Loading…</p></main>;
  }

  const selectedAsset =
    assets.find((asset) => asset.id === (selectedAssetId ?? settings.defaultAssetId)) ?? null;
  const route = createRouterSnapshot(setupComplete);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Mac Break Reminder</p>
          <h1>{statusLabel(scheduler)}</h1>
        </div>
      </header>

      {!route.isReady ? (
        <SetupScreen
          settings={settings}
          selectedAssetId={selectedAssetId}
          assets={assets}
          onSave={async (nextSettings) => {
            const saved = await settingsStore.save(nextSettings);
            setSettings(saved);
            setSetupComplete(true);
            setScheduler({
              state: "counting",
              nextBreakAt: null,
              remainingSeconds: saved.intervalMinutes * 60,
              activeBreakSeconds: saved.breakMinutes * 60
            });
          }}
          onSelectAsset={setSelectedAssetId}
        />
      ) : (
        <div className="layout">
          <DashboardScreen
            settings={settings}
            scheduler={scheduler}
            onDelay={() =>
              setScheduler((current) => ({
                ...current,
                state: "delayed",
                remainingSeconds: 10 * 60
              }))
            }
            onPauseToday={() =>
              setScheduler((current) => ({
                ...current,
                state: "paused_today",
                nextBreakAt: null,
                remainingSeconds: 0
              }))
            }
          />
          <SettingsScreen
            settings={settings}
            onChange={async (nextSettings) => {
              const saved = await settingsStore.save(nextSettings);
              setSettings(saved);
            }}
          />
          <MediaLibraryScreen
            assets={assets}
            selectedAssetId={selectedAssetId}
            onImport={async () => {
              const imported: MediaAsset = {
                id: `asset-${assets.length + 1}`,
                name: `Imported Asset ${assets.length}`,
                filePath: "/tmp/sample.webm",
                format: "webm_alpha",
                durationSeconds: 6,
                hasTransparency: true,
                enabled: true,
                builtIn: false,
                copyTheme: "Time for a tiny pause."
              };
              setAssets((current) => [...current, imported]);
            }}
            onSelect={(assetId) => {
              setSelectedAssetId(assetId);
              void settingsStore.save({ ...settings, defaultAssetId: assetId }).then(setSettings);
            }}
          />
        </div>
      )}

      <section className="preview-panel">
        <h2>Overlay Preview</h2>
        <BreakOverlay
          asset={selectedAsset}
          remainingSeconds={scheduler.activeBreakSeconds || settings.breakMinutes * 60}
          message={selectedAsset?.copyTheme ?? "Look away from the screen and take a breath."}
          preview
        />
      </section>
    </main>
  );
}
