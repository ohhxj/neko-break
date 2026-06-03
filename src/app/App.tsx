import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { emitTo } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { BrandMark } from "../components/BrandMark";
import { brandName } from "../domain/brand";
import { createSettingsStore } from "../domain/settings/store";
import { defaultSettings } from "../domain/settings/defaults";
import type { AppSettings } from "../domain/settings/types";
import type { MediaAsset, SceneClip } from "../domain/media/types";
import type { OverlayPayload, SchedulerSnapshot } from "../domain/breaks/types";
import { createMediaStore } from "../domain/media/store";
import { mergeAssets, presetAssets, makeRagdollMovScene, RAGDOLL_PRESET_ID } from "../domain/media/presets";
import { primaryClip } from "../domain/media/types";
import { probeMediaFile } from "../domain/media/probe";
import { overlayStyleLabel } from "../domain/settings/presentation";
import { createRouterSnapshot } from "./router";
import { SetupScreen } from "../features/setup/SetupScreen";
import { DashboardScreen } from "../features/dashboard/DashboardScreen";
import { SettingsScreen } from "../features/settings/SettingsScreen";
import { MediaLibraryScreen } from "../features/media-library/MediaLibraryScreen";
import { BreakOverlay } from "../features/overlay/BreakOverlay";
import {
  countdownLabel,
  trayPauseMenuLabel,
  trayTitleLabel,
  trayTooltipLabel
} from "../features/menu-bar/status";
import { createScheduler } from "../domain/breaks/scheduler";
import { reconcileSchedulerAfterSettingsChange } from "../domain/breaks/reconcile";

const settingsStore = createSettingsStore(invoke);
const mediaStore = createMediaStore(invoke);
const runningInTauri = isTauri();
const currentWindowLabel = runningInTauri ? getCurrentWindow().label : "main";

const initialScheduler: SchedulerSnapshot = {
  state: "idle",
  nextBreakAt: null,
  remainingSeconds: 0,
  activeBreakSeconds: defaultSettings.breakMinutes * 60
};

const overlayMessage = "";

// 测试弹窗时长：要能放完入场（~5s）再看到几轮循环，否则看不出衔接效果
const PREVIEW_BREAK_SECONDS = 20;

const clipDisplayName = (clip: SceneClip) =>
  clip.filePath.split("/").pop()?.replace(/\.[^.]+$/, "") ?? clip.id;
const sceneModeLabel = (asset: MediaAsset | null) => {
  if (!asset) return "未选择场景";
  if (asset.introClip && asset.outroClip) return "入场 + 循环 + 退场";
  if (asset.introClip) return "入场 + 循环";
  if (asset.outroClip) return "循环 + 退场";
  return "纯循环";
};

const encouragementCopy = (state: SchedulerSnapshot["state"]) => {
  if (state === "break_active") return "休息是为了更好地出发，先让眼睛和脑袋都松一口气。";
  if (state === "paused_today") return "忙归忙，也别忘了对自己温柔一点，想休息时随时回来。";
  if (state === "delayed") return "我知道你还在冲刺，这次先缓一缓，等会也要记得休息。";
  return "定时弹出治愈小猫场景，提醒你休息、充电、继续加油。";
};

const nextBreakTimeLabel = (snapshot: SchedulerSnapshot) => {
  if (snapshot.state === "paused_today") return "已暂停";
  if (snapshot.state === "break_active") return "休息中";
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
  const [setupComplete, setSetupComplete] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [overlayPayload, setOverlayPayload] = useState<OverlayPayload>({
    asset: null,
    remainingSeconds: 5 * 60,
    message: overlayMessage,
    style: defaultSettings.overlayStyle,
    sessionId: 0
  });

  const launchBreak = (durationSeconds: number, asset: MediaAsset | null, copy: string) => {
    const initialClip = asset ? asset.introClip ?? primaryClip(asset) : null;
    const resolvedStyle = asset?.overlayStyleHint ?? settings?.overlayStyle ?? defaultSettings.overlayStyle;
    // 当入场 + 循环 都是 mov_alpha 时，让 Rust 走双层预热模式：
    // 入场层和循环层同时挂上 contentView，循环立刻在背后播放，
    // 入场时长结束后 Rust 自动把入场层透明掉。前端不再二次切换。
    const useDualNativeLayer =
      asset?.introClip?.format === "mov_alpha" && asset?.loopClip.format === "mov_alpha";
    const nativeMedia = useDualNativeLayer
      ? {
          filePath: null,
          format: null,
          shouldLoop: null,
          nextFilePath: null,
          nextFormat: null,
          introFilePath: asset!.introClip!.filePath,
          introFormat: asset!.introClip!.format,
          introDurationMs: Math.max(0, Math.round(asset!.introClip!.durationSeconds * 1000)),
          loopFilePath: asset!.loopClip.filePath,
          loopFormat: asset!.loopClip.format
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
      sessionId: Date.now()
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
      const [loadedSettings, loadedAssets] = await Promise.all([
        settingsStore.load(),
        mediaStore.load()
      ]);

      // 把打包的 mov-alpha 预设解析成绝对路径并注入到列表最前
      let presets = presetAssets;
      if (runningInTauri) {
        try {
          const [introPath, loopPath] = await Promise.all([
            invoke<string>("resolve_preset_path", { name: "cat-intro.mov" }),
            invoke<string>("resolve_preset_path", { name: "cat-loop.mov" })
          ]);
          presets = [makeRagdollMovScene(introPath, loopPath), ...presetAssets];
        } catch {
          // resolve 失败（如纯前端 dev）则退回静态预设
        }
      }

      setSettings(loadedSettings);
      setAssets(mergeAssets(presets, loadedAssets));
      // 默认选中新 mov 预设，方便直接测试入场→循环衔接
      setSelectedAssetId(loadedSettings.defaultSceneId ?? RAGDOLL_PRESET_ID);
      setSetupComplete(Boolean(loadedSettings.defaultSceneId));
    };

    void bootstrap().catch(() => {
      setSettings(defaultSettings);
      setAssets(presetAssets);
    });
  }, []);

  const selectedAsset =
    assets.find((asset) => asset.id === (selectedAssetId ?? settings?.defaultSceneId ?? null)) ?? null;
  const resolvedPreviewStyle = selectedAsset?.overlayStyleHint ?? settings?.overlayStyle ?? defaultSettings.overlayStyle;

  const saveScene = async (scene: MediaAsset) => {
    const savedScene = await mediaStore.saveScene(scene);
    setAssets((current) => mergeAssets(current, [savedScene]));
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
    setImportStatus(`已删除场景：${asset.name}`);
  };

  const importClipFromDialog = async () => {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: "Transparent MOV",
          extensions: ["mov"]
        }
      ]
    });
    if (!selected || Array.isArray(selected)) return null;
    const { durationSeconds, pixelWidth, pixelHeight } = await probeMediaFile(selected);
    return mediaStore.importClip(selected, durationSeconds, pixelWidth, pixelHeight);
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

        const nextRemaining = Math.max(0, current.remainingSeconds - 1);

        if (nextRemaining > 0) {
          return {
            ...current,
            remainingSeconds: nextRemaining
          };
        }

        if (current.state === "break_active") {
          return createScheduler(settings, new Date()).finishBreak(new Date());
        }

        const copy = overlayMessage;
        window.setTimeout(() => {
          launchBreak(settings.breakMinutes * 60, selectedAsset, copy);
        }, 0);

        return {
          ...current,
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

  useEffect(() => {
    if (!runningInTauri || currentWindowLabel !== "main" || !settings) return;

    let stopStartBreak: (() => void) | undefined;
    let stopPauseToday: (() => void) | undefined;

    void getCurrentWindow()
      .listen("tray-start-break", () => {
        launchBreak(
          settings.breakMinutes * 60,
          selectedAsset,
          overlayMessage
        );
      })
      .then((cleanup) => {
        stopStartBreak = cleanup;
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
        stopPauseToday = cleanup;
      });

    return () => {
      stopStartBreak?.();
      stopPauseToday?.();
    };
  }, [settings, selectedAsset]);

  if (!settings) {
    return <main className="shell"><p>Loading…</p></main>;
  }

  if (currentWindowLabel === "overlay") {
    return (
      <BreakOverlay
        asset={overlayPayload.asset}
        remainingSeconds={overlayPayload.remainingSeconds}
        message={overlayPayload.message}
        style={overlayPayload.style}
        sessionId={overlayPayload.sessionId}
        dismissible
      />
    );
  }

  const route = createRouterSnapshot(setupComplete);

  return (
    <main className={runningInTauri ? "shell shell--native-titlebar" : "shell"}>
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
          <div className="hero__center">
            <h1>下一次休息 <span>{nextBreakTimeLabel(scheduler)}</span></h1>
            <p>
              每 {settings.intervalMinutes} 分钟提醒 · 休息 {settings.breakMinutes} 分钟 · 倒计时 {countdownLabel(scheduler.remainingSeconds)}
            </p>
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
            <button
              type="button"
              className="hero-start-button"
              onClick={() => launchBreak(settings.breakMinutes * 60, selectedAsset, overlayMessage)}
            >
              立即休息
            </button>
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
              onStartBreak={() => {
                launchBreak(
                  settings.breakMinutes * 60,
                  selectedAsset,
                  overlayMessage
                );
              }}
              onDelay={() =>
                setScheduler(createScheduler(settings, new Date()).delayOnce(10, new Date()))
              }
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
          </section>
          <section className="studio-zone">
            <div className="preview-panel">
              <div className="section-header">
                <div>
                  <h2>实时预览</h2>
                </div>
              </div>
              <div className="asset-summary">
                <div className="asset-summary__header">
                  <div className="asset-summary__title">
                    <span className="asset-summary__label">当前场景：</span>
                    <strong>{selectedAsset?.name ?? "还没有选择场景"}</strong>
                    {selectedAsset ? (
                      <span className="info-text">{sceneModeLabel(selectedAsset)}</span>
                    ) : null}
                  </div>
                </div>
              </div>
              <BreakOverlay
                asset={selectedAsset}
                remainingSeconds={scheduler.activeBreakSeconds || settings.breakMinutes * 60}
                message={overlayMessage}
                style={resolvedPreviewStyle}
                preview
              />
              {selectedAsset ? (
                <div className="asset-chip-row">
                  <span className="asset-chip">☕ 入场</span>
                  <span className="asset-chip">⌁ 循环 {Math.round(selectedAsset.loopClip.durationSeconds * 10) / 10}s</span>
                  <span className="asset-chip">{selectedAsset.introClip ? "◉ 有入场" : "◌ 无入场"}</span>
                  <span className="asset-chip">◍ {selectedAsset.overlayStyleHint ? overlayStyleLabel(selectedAsset.overlayStyleHint) : "跟随全局设置"}</span>
                </div>
              ) : null}
            </div>
            <MediaLibraryScreen
              assets={assets}
              selectedAssetId={selectedAsset?.id ?? selectedAssetId}
              onImport={async () => {
                setImportError(null);
                try {
                  const selected = await open({
                    multiple: false,
                    directory: false,
                    filters: [
                      {
                        name: "Transparent MOV",
                        extensions: ["mov"]
                      }
                    ]
                  });
                  if (!selected || Array.isArray(selected)) return null;
                  setImportStatus("正在读取视频信息…");
                  const { durationSeconds, pixelWidth, pixelHeight } = await probeMediaFile(selected);
                  setImportStatus("正在保存到你的场景库…");
                  const imported = await mediaStore.import(selected, durationSeconds, pixelWidth, pixelHeight);
                  setAssets((current) => mergeAssets(current, [imported]));
                  setSelectedAssetId(imported.id);
                  const savedSettings = await settingsStore.save({ ...settings, defaultSceneId: imported.id });
                  setSettings(savedSettings);
                  setImportStatus(`已成功导入 ${imported.name}`);
                  return imported;
                } catch (error) {
                  setImportError(
                      error instanceof Error
                      ? error.message
                      : "导入失败了，请使用透明 MOV（mov-alpha）视频。"
                  );
                  setImportStatus(null);
                  return null;
                }
                return null;
              }}
              onSelect={(assetId) => void selectScene(assetId)}
              onTestPreview={(asset) => launchBreak(PREVIEW_BREAK_SECONDS, asset, overlayMessage)}
              onDeleteScene={(asset) => void deleteScene(asset)}
              importError={importError}
              importStatus={importStatus}
              onAssignClip={async (asset, slot) => {
                try {
                  setImportError(null);
                  setImportStatus(`正在为 ${asset.name} 导入${slot === "intro" ? "入场" : slot === "loop" ? "循环" : "退场"}动画…`);
                  const clip = await importClipFromDialog();
                  if (!clip) {
                    setImportStatus(null);
                    return;
                  }
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
                  setImportStatus(
                    `${asset.name} 已更新${slot === "intro" ? "入场" : slot === "loop" ? "循环" : "退场"}动画：${clipDisplayName(clip)}`
                  );
                } catch (error) {
                  setImportError(error instanceof Error ? error.message : "导入片段失败了，请再试一次。");
                  setImportStatus(null);
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
                  setImportStatus(`已更新场景名称：${name}`);
                } catch (error) {
                  setImportError(error instanceof Error ? error.message : "重命名场景失败了，请再试一次。");
                  setImportStatus(null);
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
                  setImportStatus(`已更新场景展示配置：${saved.name}`);
                } catch (error) {
                  setImportError(error instanceof Error ? error.message : "更新场景配置失败了，请再试一次。");
                  setImportStatus(null);
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
                  setImportStatus(`${asset.name} 已清空${slot === "intro" ? "入场" : "退场"}动画`);
                } catch (error) {
                  setImportError(error instanceof Error ? error.message : "清空片段失败了，请再试一次。");
                  setImportStatus(null);
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
            <h3>{selectedAsset ? `默认场景：${selectedAsset.name}` : "挑一只喜欢的小猫开始吧"}</h3>
            <p>{encouragementCopy(scheduler.state)}</p>
          </div>
        </div>
        <div className="cta-panel__actions">
          <button type="button" className="secondary" onClick={() => launchBreak(PREVIEW_BREAK_SECONDS, selectedAsset, overlayMessage)}>
            ▶ 测试弹窗（{PREVIEW_BREAK_SECONDS}s）
          </button>
          <button type="button" onClick={() => undefined}>
            保存设置
          </button>
        </div>
      </section>
    </main>
  );
}
