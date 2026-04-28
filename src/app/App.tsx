import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emitTo } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { createSettingsStore } from "../domain/settings/store";
import { defaultSettings } from "../domain/settings/defaults";
import type { AppSettings } from "../domain/settings/types";
import type { MediaAsset } from "../domain/media/types";
import type { OverlayPayload, SchedulerSnapshot } from "../domain/breaks/types";
import { createMediaStore } from "../domain/media/store";
import { mergeAssets, presetAssets } from "../domain/media/presets";
import { createRouterSnapshot } from "./router";
import { SetupScreen } from "../features/setup/SetupScreen";
import { DashboardScreen } from "../features/dashboard/DashboardScreen";
import { SettingsScreen } from "../features/settings/SettingsScreen";
import { MediaLibraryScreen } from "../features/media-library/MediaLibraryScreen";
import { BreakOverlay } from "../features/overlay/BreakOverlay";
import { statusLabel } from "../features/menu-bar/status";

const settingsStore = createSettingsStore(invoke);
const mediaStore = createMediaStore(invoke);
const currentWindowLabel = getCurrentWindow().label;

const initialScheduler: SchedulerSnapshot = {
  state: "idle",
  nextBreakAt: null,
  remainingSeconds: 0,
  activeBreakSeconds: defaultSettings.breakMinutes * 60
};

export function App() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>(presetAssets);
  const [scheduler, setScheduler] = useState<SchedulerSnapshot>(initialScheduler);
  const [setupComplete, setSetupComplete] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [overlayPayload, setOverlayPayload] = useState<OverlayPayload>({
    asset: null,
    remainingSeconds: 5 * 60,
    message: "Look away from the screen and take a breath."
  });

  useEffect(() => {
    void Promise.all([settingsStore.load(), mediaStore.load()])
      .then(([loadedSettings, loadedAssets]) => {
        setSettings(loadedSettings);
        setAssets(mergeAssets(presetAssets, loadedAssets));
        setSelectedAssetId(loadedSettings.defaultAssetId);
        setSetupComplete(Boolean(loadedSettings.defaultAssetId));
      })
      .catch(() => {
        setSettings(defaultSettings);
        setAssets(presetAssets);
      });
  }, []);

  useEffect(() => {
    if (currentWindowLabel !== "overlay") return;
    let unlisten: (() => void) | undefined;
    void getCurrentWindow()
      .listen<OverlayPayload>("break-preview", (event) => {
        setOverlayPayload(event.payload);
      })
      .then((cleanup) => {
        unlisten = cleanup;
      });

    return () => {
      unlisten?.();
    };
  }, []);

  if (!settings) {
    return <main className="shell"><p>Loading…</p></main>;
  }

  const selectedAsset =
    assets.find((asset) => asset.id === (selectedAssetId ?? settings.defaultAssetId)) ?? null;

  if (currentWindowLabel === "overlay") {
    return (
      <BreakOverlay
        asset={overlayPayload.asset}
        remainingSeconds={overlayPayload.remainingSeconds}
        message={overlayPayload.message}
        dismissible
      />
    );
  }

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
            onStartBreak={() => {
              const payload: OverlayPayload = {
                asset: selectedAsset,
                remainingSeconds: settings.breakMinutes * 60,
                message:
                  selectedAsset?.copyTheme ?? "Look away from the screen and take a breath."
              };
              setOverlayPayload(payload);
              setScheduler((current) => ({
                ...current,
                state: "break_active",
                remainingSeconds: payload.remainingSeconds,
                activeBreakSeconds: payload.remainingSeconds
              }));
              void emitTo("overlay", "break-preview", payload)
                .then(() => invoke("show_overlay"))
                .catch(() => undefined);
            }}
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
              setImportError(null);
              const selected = await open({
                multiple: false,
                directory: false,
                filters: [
                  {
                    name: "Transparent Video",
                    extensions: ["webm", "mov"]
                  }
                ]
              });
              if (!selected || Array.isArray(selected)) return;
              try {
                const imported = await mediaStore.import(selected);
                setAssets((current) => mergeAssets(current, [imported]));
              } catch (error) {
                setImportError(
                  error instanceof Error
                    ? error.message
                    : "Import failed. Try a transparent WebM or MOV file."
                );
              }
            }}
            onSelect={(assetId) => {
              setSelectedAssetId(assetId);
              void settingsStore.save({ ...settings, defaultAssetId: assetId }).then(setSettings);
            }}
            importError={importError}
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
