import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { emitTo } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { BrandMark } from "../components/BrandMark";
import { Button } from "../components/Button";
import { WalkingCatCursor } from "../components/WalkingCatCursor";
import { RestFishCursor } from "../components/RestFishCursor";
import { Heart, Play, Save } from "lucide-react";
import { brandName, buildVersion } from "../domain/brand";
import { createSettingsStore } from "../domain/settings/store";
import { defaultSettings } from "../domain/settings/defaults";
import type { AppSettings } from "../domain/settings/types";
import type { MediaAsset } from "../domain/media/types";
import type { OverlayPayload, SchedulerSnapshot } from "../domain/breaks/types";
import type { BreakOutcomePayload } from "../domain/breaks/types";
import type { BreakRecord } from "../domain/break-history/types";
import { createBreakHistoryStore } from "../domain/break-history/store";
import { createMediaStore } from "../domain/media/store";
import {
  mergeAssets,
  presetAssets,
  makeRagdollMovScene,
  makeRagdollWebmScene,
  RAGDOLL_PRESET_ID
} from "../domain/media/presets";
import { primaryClip } from "../domain/media/types";
import { captureVideoPoster, probeMediaFile } from "../domain/media/probe";
import { isMacOSRuntime, isWindowsRuntime } from "../platform/runtime";
import { createRouterSnapshot } from "./router";
import { SetupScreen } from "../features/setup/SetupScreen";
import { DashboardScreen } from "../features/dashboard/DashboardScreen";
import { RestHistoryPanel } from "../features/dashboard/RestHistoryPanel";
import { SettingsScreen } from "../features/settings/SettingsScreen";
import { MediaLibraryScreen, type SceneDraft } from "../features/media-library/MediaLibraryScreen";
import { BreakOverlay } from "../features/overlay/BreakOverlay";
import supportCoffeeCat from "../assets/decor/support-coffee-cat.png";
import footerSleepingCat from "../assets/decor/footer-sleeping-cat.png";
import alipayQr from "../assets/support/alipay-qr.png";
import wechatQr from "../assets/support/wechat-qr.png";
import {
  countdownLabel,
  trayPauseMenuLabel,
  trayTitleLabel,
  trayTooltipLabel
} from "../features/menu-bar/status";
import { createScheduler, synchronizeSchedulerAtTime } from "../domain/breaks/scheduler";
import { reconcileSchedulerAfterSettingsChange } from "../domain/breaks/reconcile";
import {
  createRestPromptPicker,
  DEFAULT_REST_PROMPT
} from "../domain/breaks/rest-prompts";

const settingsStore = createSettingsStore(invoke);
const mediaStore = createMediaStore(invoke);
const breakHistoryStore = createBreakHistoryStore(invoke);
const runningInTauri = isTauri();
const currentWindowLabel = runningInTauri ? getCurrentWindow().label : "main";
const initialScheduler: SchedulerSnapshot = {
  state: "idle",
  nextBreakAt: null,
  remainingSeconds: 0,
  activeBreakSeconds: defaultSettings.breakMinutes * 60
};

const restPromptPicker = createRestPromptPicker();

// 测试弹窗时长：要能放完入场（~5s）再看到几轮循环，否则看不出衔接效果
const PREVIEW_BREAK_SECONDS = 20;

const encouragementCopy = (state: SchedulerSnapshot["state"]) => {
  if (state === "break_active") return "休息是为了更好地出发，先让眼睛和脑袋都松一口气。";
  if (state === "paused_today") return "忙归忙，也别忘了对自己温柔一点，想休息时随时回来。";
  if (state === "quiet_hours") return "现在是免打扰时间，小猫先不打断你，结束后会重新开始计时。";
  if (state === "outside_companion_hours") return "现在不在陪伴时间内，到设定时间后会重新开始提醒。";
  if (state === "delayed") return "我知道你还在冲刺，这次先缓一缓，等会也要记得休息。";
  return "定时弹出治愈小猫场景，提醒你休息、充电、继续加油。";
};

const nextBreakTimeLabel = (snapshot: SchedulerSnapshot) => {
  if (snapshot.state === "paused_today") return "已暂停";
  if (snapshot.state === "break_active") return "休息中";
  if (snapshot.state === "quiet_hours") return "免打扰中";
  if (snapshot.state === "outside_companion_hours") return "等待陪伴";
  if (!snapshot.nextBreakAt) return "--:--";
  return new Date(snapshot.nextBreakAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
};

export function App() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>(presetAssets);
  const [scheduler, setScheduler] = useState<SchedulerSnapshot>(initialScheduler);
  // The legacy setup screen made a clean install look like an outdated build.
  // New installs start with the bundled scene and can adjust everything in-place.
  const [setupComplete, setSetupComplete] = useState(true);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [supportAuthorOpen, setSupportAuthorOpen] = useState(false);
  const [breakHistory, setBreakHistory] = useState<BreakRecord[]>([]);
  const [overlayPayload, setOverlayPayload] = useState<OverlayPayload>({
    asset: null,
    remainingSeconds: 5 * 60,
    message: DEFAULT_REST_PROMPT,
    style: "immersive",
    sessionId: 0,
    trackOutcome: false
  });

  const launchBreak = (
    durationSeconds: number,
    asset: MediaAsset | null,
    trackOutcome = true
  ) => {
    const copy = restPromptPicker.next(new Date());
    const initialClip = asset ? asset.introClip ?? primaryClip(asset) : null;
    const resolvedStyle = "immersive";
    // 当 loop 是 mov_alpha，且 intro/outro 也是 mov_alpha 时，让 Rust 走原生多层预热模式。
    // intro→loop、loop→outro 都只翻 layer opacity，不在衔接点重建播放器。
    const useNativeLayerSequence =
      isMacOSRuntime &&
      asset?.loopClip.format === "mov_alpha" &&
      (!asset.introClip || asset.introClip.format === "mov_alpha") &&
      (!asset.outroClip || asset.outroClip.format === "mov_alpha") &&
      Boolean(asset.introClip || asset.outroClip);
    const nativeMedia = useNativeLayerSequence
      ? {
          filePath: null,
          format: null,
          shouldLoop: null,
          nextFilePath: null,
          nextFormat: null,
          introFilePath: asset!.introClip?.filePath ?? null,
          introFormat: asset!.introClip?.format ?? null,
          introDurationMs: asset!.introClip ? Math.max(0, Math.round(asset!.introClip.durationSeconds * 1000)) : null,
          loopFilePath: asset!.loopClip.filePath,
          loopFormat: asset!.loopClip.format,
          outroFilePath: asset!.outroClip?.filePath ?? null,
          outroFormat: asset!.outroClip?.format ?? null,
          outroDurationMs: asset!.outroClip ? Math.max(0, Math.round(asset!.outroClip.durationSeconds * 1000)) : null
        }
      : initialClip && initialClip.format === "mov_alpha"
      ? {
          filePath: initialClip.filePath,
          format: initialClip.format,
          shouldLoop: !asset?.introClip,
          nextFilePath: null,
          nextFormat: null
        }
      : null;

    const payload: OverlayPayload = {
      asset,
      remainingSeconds: durationSeconds,
      message: copy,
      style: resolvedStyle,
      sessionId: Date.now(),
      trackOutcome
    };
    setOverlayPayload(payload);
    setScheduler((current) => ({
      ...current,
      state: "break_active",
      remainingSeconds: durationSeconds,
      activeBreakSeconds: durationSeconds
    }));
    void emitTo("overlay", "break-preview", payload)
      .catch(() => undefined)
      .then(() =>
        invoke("show_overlay", {
          style: payload.style,
          media: nativeMedia
        })
      )
      .then(() => emitTo("overlay", "break-preview", payload).catch(() => undefined))
      .catch(() => undefined);
  };

  useEffect(() => {
    const bootstrap = async () => {
      const [loadedSettings, loadedAssets, loadedBreakHistory] = await Promise.all([
        settingsStore.load(),
        mediaStore.load(),
        breakHistoryStore.load()
      ]);

      // 把打包的 mov-alpha 预设解析成绝对路径并注入到列表最前
      let presets = presetAssets;
      if (runningInTauri) {
        try {
          const presetExtension = isWindowsRuntime ? "webm" : "mov";
          const [introPath, loopPath] = await Promise.all([
            invoke<string>("resolve_preset_path", { name: `cat-intro.${presetExtension}` }),
            invoke<string>("resolve_preset_path", { name: `cat-loop.${presetExtension}` })
          ]);
          const platformPreset = isWindowsRuntime
            ? makeRagdollWebmScene(introPath, loopPath)
            : makeRagdollMovScene(introPath, loopPath);
          presets = [platformPreset, ...presetAssets];
        } catch {
          // resolve 失败（如纯前端 dev）则退回静态预设
        }
      }

      const readySettings = loadedSettings.defaultSceneId
        ? loadedSettings
        : await settingsStore.save({
            ...loadedSettings,
            defaultSceneId: RAGDOLL_PRESET_ID
          });

      setSettings(readySettings);
      setBreakHistory(loadedBreakHistory);
      setAssets(mergeAssets(presets, loadedAssets));
      setSelectedAssetId(readySettings.defaultSceneId ?? RAGDOLL_PRESET_ID);
      setSetupComplete(true);
    };

    void bootstrap().catch(() => {
      setSettings({
        ...defaultSettings,
        defaultSceneId: RAGDOLL_PRESET_ID
      });
      setAssets(presetAssets);
      setSelectedAssetId(RAGDOLL_PRESET_ID);
      setSetupComplete(true);
    });
  }, []);

  const selectedAsset =
    assets.find((asset) => asset.id === (selectedAssetId ?? settings?.defaultSceneId ?? null)) ?? null;
  const resolvedPreviewStyle = "immersive";

  const saveScene = async (scene: MediaAsset) => {
    const savedScene = await mediaStore.saveScene(scene);
    setAssets((current) => mergeAssets(current, [savedScene]));
    return savedScene;
  };

  const createScene = async (draft: SceneDraft) => {
    if (!settings) throw new Error("设置尚未加载完成，请稍后再试。");
    const sceneId = `scene-${Date.now()}`;
    const scene: MediaAsset = {
      id: sceneId,
      name: draft.name,
      filePath: draft.loopClip.filePath,
      previewImagePath: draft.loopClip.previewImagePath,
      format: draft.loopClip.format,
      durationSeconds: draft.loopClip.durationSeconds,
      fileSizeBytes: draft.loopClip.fileSizeBytes,
      pixelWidth: draft.loopClip.pixelWidth,
      pixelHeight: draft.loopClip.pixelHeight,
      hasTransparency: draft.loopClip.hasTransparency,
      enabled: true,
      builtIn: false,
      copyTheme: null,
      coverImagePath: draft.loopClip.previewImagePath,
      introClip: draft.introClip,
      loopClip: draft.loopClip,
      outroClip: draft.outroClip,
      overlayStyleHint: null,
      closeButtonLabel: null
    };
    const savedScene = await saveScene(scene);
    setSelectedAssetId(savedScene.id);
    const savedSettings = await settingsStore.save({ ...settings, defaultSceneId: savedScene.id });
    setSettings(savedSettings);
    return savedScene;
  };

  const selectScene = async (assetId: string) => {
    if (!settings) return;
    setSelectedAssetId(assetId);
    const savedSettings = await settingsStore.save({ ...settings, defaultSceneId: assetId });
    setSettings(savedSettings);
  };

  const deleteScene = async (asset: MediaAsset) => {
    if (!settings) return;
    if (asset.builtIn) {
      setImportError("内置场景不能删除，可以换成其它默认场景。");
      return;
    }
    const nextAssets = mergeAssets(presetAssets, await mediaStore.deleteScene(asset.id));
    const fallbackScene = nextAssets.find((item) => item.id !== asset.id) ?? null;
    setAssets(nextAssets);
    if (selectedAssetId === asset.id || settings.defaultSceneId === asset.id) {
      setSelectedAssetId(fallbackScene?.id ?? null);
      const savedSettings = await settingsStore.save({
        ...settings,
        defaultSceneId: fallbackScene?.id ?? null
      });
      setSettings(savedSettings);
    }
  };

  const importClipFromDialog = async () => {
    const mediaFilter = isWindowsRuntime
      ? { name: "透明 WebM（Windows）", extensions: ["webm"] }
      : { name: "透明 MOV（macOS）", extensions: ["mov"] };
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [mediaFilter]
    });
    if (!selected || Array.isArray(selected)) return null;
    const { durationSeconds, pixelWidth, pixelHeight } = await probeMediaFile(selected);
    const previewImageDataUrl = isWindowsRuntime ? await captureVideoPoster(selected) : null;
    return mediaStore.importClip(
      selected,
      durationSeconds,
      pixelWidth,
      pixelHeight,
      previewImageDataUrl
    );
  };

  useEffect(() => {
    if (!settings || !setupComplete || currentWindowLabel === "overlay") return;
    setScheduler((current) => {
      if (current.state !== "idle") return current;
      return createScheduler(settings, new Date()).start();
    });
  }, [settings, setupComplete]);

  useEffect(() => {
    if (!settings || currentWindowLabel === "overlay") return;
    if (scheduler.state === "paused_today" || scheduler.state === "idle") return;

    const timer = window.setInterval(() => {
      setScheduler((current) => {
        if (current.state === "paused_today" || current.state === "idle") return current;
        const now = new Date();

        const synchronized =
          current.state === "break_active"
            ? current
            : synchronizeSchedulerAtTime(current, settings, now);
        if (
          synchronized.state === "quiet_hours" ||
          synchronized.state === "outside_companion_hours"
        ) return synchronized;

        const nextRemaining =
          synchronized.state === "break_active"
            ? Math.max(0, synchronized.remainingSeconds - 1)
            : synchronized.remainingSeconds;

        if (nextRemaining > 0) {
          return {
            ...synchronized,
            remainingSeconds: nextRemaining
          };
        }

        if (synchronized.state === "break_active") {
          return createScheduler(settings, now).finishBreak(now);
        }

        window.setTimeout(() => {
          launchBreak(settings.breakMinutes * 60, selectedAsset);
        }, 0);

        return {
          ...synchronized,
          state: "break_active",
          remainingSeconds: settings.breakMinutes * 60,
          activeBreakSeconds: settings.breakMinutes * 60
        };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [scheduler.state, settings, selectedAsset]);

  useEffect(() => {
    if (!runningInTauri || currentWindowLabel !== "main") return;
    void invoke("update_tray_tooltip", {
      tooltip: trayTooltipLabel(scheduler)
    }).catch(() => undefined);
    void invoke("update_tray_title", {
      title: trayTitleLabel(scheduler)
    }).catch(() => undefined);
    void invoke("update_tray_pause_label", {
      label: trayPauseMenuLabel(scheduler.state)
    }).catch(() => undefined);
    void invoke("update_tray_pause_enabled", {
      enabled: true
    }).catch(() => undefined);
  }, [scheduler, settings]);

  useEffect(() => {
    if (!runningInTauri || currentWindowLabel !== "overlay") return;
    let unlisten: (() => void) | undefined;
    let disposed = false;
    void getCurrentWindow()
      .listen<OverlayPayload>("break-preview", (event) => {
        setOverlayPayload(event.payload);
      })
      .then((cleanup) => {
        if (disposed) {
          cleanup();
        } else {
          unlisten = cleanup;
        }
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!runningInTauri || currentWindowLabel !== "main" || !settings) return;

    let stopStartBreak: (() => void) | undefined;
    let stopPauseToday: (() => void) | undefined;
    let stopBreakOutcome: (() => void) | undefined;
    let disposed = false;

    const retainListener = (
      cleanup: () => void,
      retain: (listener: () => void) => void
    ) => {
      if (disposed) {
        cleanup();
      } else {
        retain(cleanup);
      }
    };

    void getCurrentWindow()
      .listen("tray-start-break", () => {
        launchBreak(
          settings.breakMinutes * 60,
          selectedAsset
        );
      })
      .then((cleanup) => {
        retainListener(cleanup, (listener) => {
          stopStartBreak = listener;
        });
      });

    void getCurrentWindow()
      .listen("tray-pause-today", () => {
        setScheduler((current) =>
          current.state === "paused_today"
            ? createScheduler(settings, new Date()).start()
            : {
                ...current,
                state: "paused_today",
                nextBreakAt: null,
                remainingSeconds: 0
              }
        );
      })
      .then((cleanup) => {
        retainListener(cleanup, (listener) => {
          stopPauseToday = listener;
        });
      });

    void getCurrentWindow()
      .listen<BreakOutcomePayload>("break-outcome", (event) => {
        const record = event.payload;
        const occurredAt = new Date(record.occurredAt);
        const now = Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt;
        setScheduler((current) => {
          if (current.state !== "break_active") return current;
          return createScheduler(settings, now).finishBreak(now);
        });
        setBreakHistory((current) =>
          current.some((item) => item.sessionId === record.sessionId)
            ? current
            : [...current, record]
        );
        void breakHistoryStore.record(record).then(setBreakHistory).catch(() => undefined);
      })
      .then((cleanup) => {
        retainListener(cleanup, (listener) => {
          stopBreakOutcome = listener;
        });
      });

    return () => {
      disposed = true;
      stopStartBreak?.();
      stopPauseToday?.();
      stopBreakOutcome?.();
    };
  }, [settings, selectedAsset]);

  if (!settings) {
    return <main className="shell"><p>Loading…</p></main>;
  }

  if (currentWindowLabel === "overlay") {
    return (
      <>
        <RestFishCursor />
        <BreakOverlay
          asset={overlayPayload.asset}
          remainingSeconds={overlayPayload.remainingSeconds}
          message={overlayPayload.message}
          style={overlayPayload.style}
          sessionId={overlayPayload.sessionId}
          trackOutcome={overlayPayload.trackOutcome}
          dismissible
        />
      </>
    );
  }

  const route = createRouterSnapshot(setupComplete);

  return (
    <main className={runningInTauri ? "shell shell--native-titlebar" : "shell"}>
      <WalkingCatCursor />
      {!runningInTauri ? (
        <div className="window-titlebar" aria-hidden="true">
          <span className="window-dot window-dot--red" />
          <span className="window-dot window-dot--yellow" />
          <span className="window-dot window-dot--green" />
          <span className="window-titlebar__name">{brandName}</span>
        </div>
      ) : null}
      <header className="topbar">
        <div className="hero">
          <div className="hero__brand">
            <BrandMark className="brand-mark" />
            <div>
              <h2>{brandName}</h2>
            </div>
          </div>
          <div className="hero__mood" aria-label="今日休息提醒">
            <span className="hero__mood-paw" aria-hidden="true" />
            <span>今天也要好好休息呀</span>
            <span aria-hidden="true">✦</span>
          </div>
          <div className="hero__actions">
            <label className="hero-toggle">
              <span>今日启用</span>
              <input
                type="checkbox"
                checked={scheduler.state !== "paused_today"}
                onChange={(event) => {
                  if (event.target.checked) {
                    setScheduler(createScheduler(settings, new Date()).start());
                    return;
                  }
                  setScheduler((current) => ({
                    ...current,
                    state: "paused_today",
                    nextBreakAt: null,
                    remainingSeconds: 0
                  }));
                }}
              />
              <span className="toggle-switch" aria-hidden="true" />
            </label>
            <Button
              type="button"
              className="hero-start-button"
              variant="accent"
              size="lg"
              onClick={() => launchBreak(settings.breakMinutes * 60, selectedAsset)}
            >
              立即休息
            </Button>
          </div>
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
            setSelectedAssetId(saved.defaultSceneId);
            setSetupComplete(true);
            setScheduler(createScheduler(saved, new Date()).start());
          }}
          onSelectAsset={setSelectedAssetId}
        />
      ) : (
        <div className="layout">
          <section className="dashboard-zone">
            <DashboardScreen
              settings={settings}
              scheduler={scheduler}
              onPauseToday={() =>
                setScheduler((current) => ({
                  ...current,
                  state: "paused_today",
                  nextBreakAt: null,
                  remainingSeconds: 0
                }))
              }
              onResume={() => setScheduler(createScheduler(settings, new Date()).start())}
            />
          </section>
          <section className="settings-zone">
            <SettingsScreen
              settings={settings}
              onChange={async (nextSettings) => {
                const previousSettings = settings;
                const saved = await settingsStore.save(nextSettings);
                setSettings(saved);
                setScheduler((current) =>
                  reconcileSchedulerAfterSettingsChange(
                    current,
                    previousSettings,
                    saved,
                    setupComplete,
                    new Date()
                  )
                );
              }}
            />
            <RestHistoryPanel records={breakHistory} />
          </section>
          <section className="studio-zone">
            <div className="preview-panel">
              <div className="section-header preview-panel__header">
                <div className="preview-panel__title-group">
                  <h2>实时预览</h2>
                  <div
                    className="preview-current-scene"
                    title={selectedAsset?.name ?? "还没有选择场景"}
                  >
                    <span>当前场景：</span>
                    <strong>{selectedAsset?.name ?? "还没有选择场景"}</strong>
                  </div>
                </div>
                <Button
                  type="button"
                  className="preview-test-button"
                  variant="secondary"
                  size="sm"
                  icon={<Play aria-hidden="true" />}
                  onClick={() => launchBreak(PREVIEW_BREAK_SECONDS, selectedAsset, false)}
                >
                  测试弹窗（{PREVIEW_BREAK_SECONDS}s）
                </Button>
              </div>
              <BreakOverlay
                asset={selectedAsset}
                remainingSeconds={scheduler.activeBreakSeconds || settings.breakMinutes * 60}
                message={DEFAULT_REST_PROMPT}
                style={resolvedPreviewStyle}
                preview
              />
            </div>
            <MediaLibraryScreen
              assets={assets}
              selectedAssetId={selectedAsset?.id ?? selectedAssetId}
              onImportClip={importClipFromDialog}
              onCreateScene={createScene}
              onSelect={(assetId) => void selectScene(assetId)}
              onTestPreview={(asset) => launchBreak(PREVIEW_BREAK_SECONDS, asset, false)}
              onDeleteScene={(asset) => void deleteScene(asset)}
              onSupportAuthor={() => setSupportAuthorOpen(true)}
              importError={importError}
              onAssignClip={async (asset, slot) => {
                try {
                  setImportError(null);
                  const clip = await importClipFromDialog();
                  if (!clip) return;
                  const nextScene: MediaAsset = {
                    ...asset,
                    introClip: slot === "intro" ? clip : asset.introClip,
                    outroClip: slot === "outro" ? clip : asset.outroClip,
                    loopClip: slot === "loop" ? clip : asset.loopClip,
                    ...(slot === "loop"
                      ? {
                          filePath: clip.filePath,
                          previewImagePath: clip.previewImagePath,
                          format: clip.format,
                          durationSeconds: clip.durationSeconds,
                          fileSizeBytes: clip.fileSizeBytes,
                          pixelWidth: clip.pixelWidth,
                          pixelHeight: clip.pixelHeight,
                          hasTransparency: clip.hasTransparency,
                          coverImagePath: clip.previewImagePath
                        }
                      : {})
                  };
                  const saved = await saveScene(nextScene);
                  setSelectedAssetId(saved.id);
                } catch (error) {
                  setImportError(error instanceof Error ? error.message : "导入片段失败了，请再试一次。");
                }
              }}
              onRenameScene={async (asset, name) => {
                try {
                  setImportError(null);
                  const saved = await saveScene({
                    ...asset,
                    name
                  });
                  setSelectedAssetId(saved.id);
                } catch (error) {
                  setImportError(error instanceof Error ? error.message : "重命名场景失败了，请再试一次。");
                }
              }}
              onUpdateSceneMeta={async (asset, patch) => {
                try {
                  setImportError(null);
                  const saved = await saveScene({
                    ...asset,
                    ...patch
                  });
                  setSelectedAssetId(saved.id);
                } catch (error) {
                  setImportError(error instanceof Error ? error.message : "更新场景配置失败了，请再试一次。");
                }
              }}
              onClearClip={async (asset, slot) => {
                try {
                  setImportError(null);
                  const nextScene: MediaAsset = {
                    ...asset,
                    introClip: slot === "intro" ? null : asset.introClip,
                    outroClip: slot === "outro" ? null : asset.outroClip
                  };
                  await saveScene(nextScene);
                } catch (error) {
                  setImportError(error instanceof Error ? error.message : "清空片段失败了，请再试一次。");
                }
              }}
            />
          </section>
        </div>
      )}

      <section className="cta-panel">
        <div className="cta-panel__pet">
          <BrandMark className="cta-panel__pet-mark" />
          <div>
            <p className="eyebrow">当前配置</p>
            <h3>
              {selectedAsset ? `默认场景：${selectedAsset.name}` : "挑一只喜欢的小猫开始吧"}
              <span className="app-version">{buildVersion}</span>
            </h3>
            <p>{encouragementCopy(scheduler.state)}</p>
          </div>
        </div>
        <div className="cta-panel__decor" aria-hidden="true">
          <span className="cta-panel__sparkles">✦ ✧</span>
          <img src={footerSleepingCat} alt="" />
        </div>
        <div className="cta-panel__actions">
          <Button
            type="button"
            className="support-button"
            variant="secondary"
            size="lg"
            icon={<Heart aria-hidden="true" />}
            onClick={() => setSupportAuthorOpen(true)}
          >
            支持作者
          </Button>
          <Button type="button" variant="accent" size="lg" icon={<Save aria-hidden="true" />} onClick={() => undefined}>
            保存设置
          </Button>
        </div>
      </section>
      {supportAuthorOpen ? <SupportAuthorModal onClose={() => setSupportAuthorOpen(false)} /> : null}
    </main>
  );
}

function SupportAuthorModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="support-modal-backdrop" role="presentation" onClick={onClose}>
      <section className="support-modal" role="dialog" aria-modal="true" aria-labelledby="support-title" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="support-modal__close" aria-label="关闭支持作者弹窗" onClick={onClose}>
          ×
        </button>
        <div className="support-modal__copy">
          <p className="support-modal__eyebrow">喜欢 Neko Break？</p>
          <h2 id="support-title">请作者喝杯咖啡 ☕</h2>
          <div className="support-modal__divider" />
          <p className="info-text">你的支持会用于：</p>
          <ul>
            <li>制作更多猫咪场景</li>
            <li>优化提醒体验</li>
            <li>持续维护免费版本</li>
          </ul>
        </div>
        <div className="support-modal__cat" aria-hidden="true">
          <img src={supportCoffeeCat} alt="" />
        </div>
        <div className="support-modal__codes">
          <SupportQrCard tone="wechat" title="微信赞赏码" subtitle="打开微信扫一扫，赞赏支持" />
          <SupportQrCard tone="alipay" title="支付宝收款码" subtitle="打开支付宝扫一扫，赞赏支持" />
        </div>
        <div className="support-modal__actions">
          <Button type="button" variant="secondary" size="md" onClick={onClose}>
            暂时不用
          </Button>
          <Button type="button" variant="accent" size="md" icon={<Heart aria-hidden="true" />} onClick={onClose}>
            谢谢支持
          </Button>
        </div>
        <p className="support-modal__note">Neko Break 完全免费，赞赏纯属自愿，感谢你的喜欢与支持！</p>
      </section>
    </div>
  );
}

function SupportQrCard({
  tone,
  title,
  subtitle
}: {
  tone: "wechat" | "alipay";
  title: string;
  subtitle: string;
}) {
  return (
    <article className={`support-qr support-qr--${tone}`}>
      <div className="support-qr__header">
        <span className="support-qr__icon" aria-hidden="true">{tone === "wechat" ? "微" : "支"}</span>
        <div>
          <strong>{title}</strong>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="support-qr__code">
        <img src={tone === "wechat" ? wechatQr : alipayQr} alt={`${title}二维码`} />
      </div>
    </article>
  );
}
