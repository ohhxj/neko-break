import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";
import { emitTo } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { primaryClip, type MediaAsset, type SceneClip, type SceneInteraction } from "../../domain/media/types";
import type { OverlayPlaybackPhase } from "../../domain/breaks/types";
import type { BreakOutcome } from "../../domain/break-history/types";
import type { OverlayStyle } from "../../domain/settings/types";
import { overlayCountdownMode, overlayDismissAction, sceneClipsMatchFormat } from "./playback";
import { useBreakOverlay } from "./useBreakOverlay";
import { useEffect, useRef, useState } from "react";
import { Leaf } from "lucide-react";
import restPeekingCat from "../../assets/overlay/rest-peeking-cat.png";
import { isFileSystemPath, isMacOSRuntime } from "../../platform/runtime";

// 把绝对路径转成 Tauri 可消费的 src
// （重复出现，提到顶部以便组件内多处复用）
const VIDEO_STACK_PRELOAD = "auto" as const;

type Props = {
  asset: MediaAsset | null;
  remainingSeconds: number;
  message: string;
  style?: OverlayStyle;
  preview?: boolean;
  dismissible?: boolean;
  sessionId?: number;
  trackOutcome?: boolean;
};

const formatClock = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

// 真实文件系统绝对路径（用户导入素材 / Rust 生成的 poster），
// 区别于 vite 打包出的 asset URL（预设图片）。后者不能当文件路径读盘。
const toMediaUrl = (filePath: string) => {
  if (!filePath) return "";
  if (isFileSystemPath(filePath) && isTauri()) {
    return convertFileSrc(filePath);
  }
  return filePath;
};

const toImageUrl = (filePath: string | null | undefined) => {
  if (!filePath) return "";
  return toMediaUrl(filePath);
};

const clipForPhase = (asset: MediaAsset | null, phase: OverlayPlaybackPhase): SceneClip | null => {
  if (!asset) return null;
  if (phase === "intro") return asset.introClip;
  if (phase === "outro") return asset.outroClip;
  if (phase === "loop") return primaryClip(asset);
  return null;
};

export function BreakOverlay({
  asset,
  remainingSeconds,
  message,
  style = "immersive",
  preview = false,
  dismissible = false,
  sessionId = 0,
  trackOutcome = false
}: Props) {
  const previewSceneSeconds = Math.min(remainingSeconds, 5);
  const liveSeconds = useBreakOverlay(preview ? previewSceneSeconds : remainingSeconds, !preview, sessionId);
  const completionHandled = useRef(false);
  const suppressRecovery = useRef(false);
  const closeRequested = useRef(false);
  const manualDismissRequested = useRef(false);
  const outcomeNotified = useRef(false);
  const nativeRecoveryArmed = useRef(false);
  const lastRenderableClip = useRef<SceneClip | null>(null);
  const liveSecondsRef = useRef(remainingSeconds);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [animatedImageUrl, setAnimatedImageUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<OverlayPlaybackPhase>(() => (asset?.introClip ? "intro" : "loop"));
  const [activeInteraction, setActiveInteraction] = useState<SceneInteraction | null>(null);
  const [interactionMenu, setInteractionMenu] = useState<{ x: number; y: number } | null>(null);
  const interactions = asset?.interactions ?? [];
  const currentClip = activeInteraction?.clip ?? clipForPhase(asset, phase);
  const effectiveClip = currentClip ?? (!preview && phase === "closing" ? lastRenderableClip.current : null);
  const useNativeVideo =
    !preview && isTauri() && isMacOSRuntime && effectiveClip?.format === "mov_alpha";
  const showImagePreview = preview && Boolean(effectiveClip?.previewImagePath);
  const showAnimatedImage = !preview && effectiveClip?.format === "apng_alpha";
  const showMovPreviewFallback = preview && effectiveClip?.format === "mov_alpha" && !effectiveClip?.previewImagePath;
  const dismissLabel = asset?.closeButtonLabel?.trim() || "小猫让开";
  const restPrompt = message.trim() || "看看远处，活动一下肩颈";
  const countdownMode = overlayCountdownMode(liveSeconds, remainingSeconds);
  const restProgress = remainingSeconds > 0
    ? Math.max(0, Math.min(1, liveSeconds / remainingSeconds))
    : 0;
  // Seamless 双 video 叠层只用于：非预览、非原生 MOV、循环是 webm，且至少存在循环 clip。
  // 入场可有可无；存在时另起一层、由 onEnded 驱动切换，彻底避免「重新挂载-重新解码」造成的卡顿。
  const useSeamlessHtmlVideoStack =
    !preview &&
    !useNativeVideo &&
    !showAnimatedImage &&
    Boolean(asset?.loopClip) &&
    sceneClipsMatchFormat(asset, "webm_alpha");
  const useTransparentImageOverlay =
    !preview && (showAnimatedImage || useNativeVideo || useSeamlessHtmlVideoStack);
  // 当 loop 是 mov_alpha，且 intro/outro 也是 mov_alpha 时，原生侧走多层预热模式。
  // 前端不再为 phase 切换发 update_overlay_media，避免在衔接点重建播放器。
  const useNativeLayerSequence =
    !preview &&
    isTauri() &&
    isMacOSRuntime &&
    sceneClipsMatchFormat(asset, "mov_alpha") &&
    Boolean(asset?.introClip || asset?.outroClip || interactions.length > 0);
  const loopVideoRef = useRef<HTMLVideoElement | null>(null);
  const outroVideoRef = useRef<HTMLVideoElement | null>(null);
  const interactionVideoRefs = useRef(new Map<string, HTMLVideoElement>());

  const returnToHtmlLoopStart = (interactionId: string) => {
    const loopVideo = loopVideoRef.current;
    if (!loopVideo) {
      setActiveInteraction((current) => current?.id === interactionId ? null : current);
      return;
    }

    const revealRestartedLoop = () => {
      void loopVideo.play().catch(() => undefined).finally(() => {
        setActiveInteraction((current) => current?.id === interactionId ? null : current);
      });
    };

    loopVideo.pause();
    if (loopVideo.currentTime <= 0.01 && loopVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      revealRestartedLoop();
      return;
    }

    const handleSeeked = () => revealRestartedLoop();
    loopVideo.addEventListener("seeked", handleSeeked, { once: true });
    try {
      loopVideo.currentTime = 0;
    } catch {
      loopVideo.removeEventListener("seeked", handleSeeked);
      revealRestartedLoop();
    }
  };

  useEffect(() => {
    liveSecondsRef.current = liveSeconds;
  }, [liveSeconds]);

  const notifyBreakOutcome = (outcome: BreakOutcome) => {
    if (preview || !trackOutcome || outcomeNotified.current) return;
    outcomeNotified.current = true;
    const actualSeconds =
      outcome === "completed"
        ? remainingSeconds
        : Math.max(0, remainingSeconds - liveSecondsRef.current);
    void emitTo("main", "break-outcome", {
      sessionId,
      outcome,
      occurredAt: new Date().toISOString(),
      actualSeconds,
      plannedSeconds: remainingSeconds
    }).catch(() => undefined);
  };

  const beginClosing = () => {
    if (!completionHandled.current) {
      completionHandled.current = true;
      suppressRecovery.current = true;
      setPhase("closing");
    }
    if (!preview) {
      void invoke(manualDismissRequested.current ? "hide_overlay_silently" : "hide_overlay").catch(() => undefined);
    }
  };

  const requestDismiss = (reason: "manual" | "timer" = "manual") => {
    const action = overlayDismissAction(
      phase,
      Boolean(asset?.outroClip),
      closeRequested.current
    );
    if (action === "ignore") return;

    closeRequested.current = true;
    if (reason === "manual") {
      manualDismissRequested.current = true;
      notifyBreakOutcome("deferred");
    } else {
      notifyBreakOutcome("completed");
    }

    if (action === "play_outro") {
      setPhase("outro");
    } else {
      beginClosing();
    }
  };

  useEffect(() => {
    setPhase(asset?.introClip ? "intro" : "loop");
    completionHandled.current = false;
    suppressRecovery.current = false;
    closeRequested.current = false;
    manualDismissRequested.current = false;
    outcomeNotified.current = false;
    lastRenderableClip.current = null;
    setActiveInteraction(null);
    setInteractionMenu(null);
  }, [asset?.id, remainingSeconds, sessionId, trackOutcome]);

  useEffect(() => {
    if (currentClip) {
      lastRenderableClip.current = currentClip;
    }
  }, [currentClip]);

  useEffect(() => {
    let cancelled = false;

    if (!showImagePreview || !effectiveClip?.previewImagePath) {
      setPreviewImageUrl(null);
      return;
    }

    // 预设的预览图是 vite 打包的 asset URL，直接当 <img src> 用；
    // 只有真实文件路径（用户导入素材 / Rust 生成的 poster）才走 load_preview_image 读盘。
    if (!isTauri() || !isFileSystemPath(effectiveClip.previewImagePath)) {
      setPreviewImageUrl(toImageUrl(effectiveClip.previewImagePath));
      return;
    }

    void invoke<string>("load_preview_image", { filePath: effectiveClip.previewImagePath })
      .then((dataUrl) => {
        if (!cancelled) {
          setPreviewImageUrl(dataUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewImageUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveClip?.previewImagePath, showImagePreview]);

  useEffect(() => {
    let cancelled = false;

    if (!showAnimatedImage || !effectiveClip?.filePath) {
      setAnimatedImageUrl(null);
      return;
    }

    if (!isTauri()) {
      setAnimatedImageUrl(toMediaUrl(effectiveClip.filePath));
      return;
    }

    void invoke<string>("load_preview_image", { filePath: effectiveClip.filePath })
      .then((dataUrl) => {
        if (!cancelled) {
          setAnimatedImageUrl(dataUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAnimatedImageUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveClip?.filePath, showAnimatedImage]);

  useEffect(() => {
    if (preview) return;
    document.documentElement.classList.add("overlay-window");
    document.body.classList.add("overlay-window");
    document.getElementById("root")?.classList.add("overlay-window");

    return () => {
      document.documentElement.classList.remove("overlay-window");
      document.body.classList.remove("overlay-window");
      document.getElementById("root")?.classList.remove("overlay-window");
    };
  }, [preview]);

  useEffect(() => {
    if (preview || liveSeconds > 0) return;
    requestDismiss("timer");
  }, [liveSeconds, preview, phase, asset?.outroClip]);

  useEffect(() => {
    if (phase !== "intro" || !asset?.introClip) return;
    // 双 video 叠层模式下由 intro <video> 的 onEnded 精准触发切换，不再用 setTimeout。
    if (useSeamlessHtmlVideoStack) return;
    const timer = window.setTimeout(() => {
      // 原生多层模式下 Rust 自管时序，前端只更新 phase；
      // 单层 mov_alpha 才需要 invoke 切换。
      if (!preview && isTauri() && asset.loopClip.format === "mov_alpha" && !useNativeLayerSequence) {
        void invoke("update_overlay_media", {
          media: {
            filePath: asset.loopClip.filePath,
            format: asset.loopClip.format,
            shouldLoop: true,
            nextFilePath: null,
            nextFormat: null
          }
        }).catch(() => undefined);
      }
      setPhase("loop");
    }, Math.max(100, Math.round(asset.introClip.durationSeconds * 1000)));
    return () => window.clearTimeout(timer);
  }, [asset?.introClip, asset?.loopClip.filePath, asset?.loopClip.format, phase, preview, useSeamlessHtmlVideoStack, useNativeLayerSequence]);

  useEffect(() => {
    if (phase !== "outro" || !asset?.outroClip) return;
    // 同样：seamless 模式下 outro 的结束由 onEnded 驱动；预览模式仍依赖 setTimeout 做循环演示。
    if (useSeamlessHtmlVideoStack && !preview) return;
    const timer = window.setTimeout(() => {
      if (preview) {
        setPhase(asset?.introClip ? "intro" : "loop");
        return;
      }
      beginClosing();
    }, Math.max(100, Math.round(asset.outroClip.durationSeconds * 1000)));
    return () => window.clearTimeout(timer);
  }, [phase, asset?.introClip, asset?.outroClip, preview, useSeamlessHtmlVideoStack]);

  useEffect(() => {
    if (preview || phase !== "outro" || !asset?.outroClip || !useNativeLayerSequence) return;
    void invoke("play_overlay_outro").catch(() => undefined);
  }, [asset?.outroClip, phase, preview, useNativeLayerSequence]);

  // 进入 outro 时，imperatively 把预挂载的 outro video 从头播放
  useEffect(() => {
    if (!useSeamlessHtmlVideoStack) return;
    if (phase !== "outro") return;
    const node = outroVideoRef.current;
    if (!node) return;
    try {
      node.currentTime = 0;
    } catch {
      /* 某些浏览器在元数据未就绪时 set currentTime 会抛 */
    }
    void node.play().catch(() => undefined);
  }, [phase, useSeamlessHtmlVideoStack]);

  useEffect(() => {
    if (!preview || phase !== "loop" || !asset?.outroClip) return;
    const timer = window.setTimeout(() => {
      setPhase("outro");
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [preview, phase, asset?.outroClip]);

  useEffect(() => {
    if (!activeInteraction) return;
    // HTML 叠层模式由真实的 onEnded 返回循环，避免解码耗时侵占动作时长。
    // 原生 MOV 仍由时长维护前端交互状态，画面切换由预挂载的 AVPlayerLayer 完成。
    if (useSeamlessHtmlVideoStack) return;
    const timer = window.setTimeout(() => {
      setActiveInteraction(null);
    }, Math.max(100, Math.round(activeInteraction.clip.durationSeconds * 1000)));
    return () => window.clearTimeout(timer);
  }, [activeInteraction, useSeamlessHtmlVideoStack]);

  useEffect(() => {
    if (preview || !useNativeLayerSequence || !isTauri()) return;
    if (activeInteraction) {
      void invoke("play_overlay_interaction", { interactionId: activeInteraction.id }).catch(() => undefined);
      return;
    }
    void invoke("stop_overlay_interaction").catch(() => undefined);
  }, [activeInteraction?.id, preview, useNativeLayerSequence]);

  useEffect(() => {
    if (preview || !isTauri()) return;
    if (phase === "closing") return;
    // 原生多层模式下 Rust 在 show_overlay 阶段一次性建好 layer，
    // 中途切换会摧毁多层、重建单层，反而引入卡顿。直接跳过。
    if (useNativeLayerSequence && (phase === "intro" || phase === "loop" || phase === "outro")) return;
    const clip = effectiveClip;
    if (!clip) return;
    void invoke("update_overlay_media", {
      media: {
        filePath: clip.filePath,
        format: clip.format,
        shouldLoop: phase === "loop" && !activeInteraction,
        nextFilePath: null,
        nextFormat: null
      }
    }).catch(() => undefined);
  }, [activeInteraction, effectiveClip?.id, effectiveClip?.filePath, effectiveClip?.format, phase, preview, useNativeLayerSequence]);

  useEffect(() => {
    if (preview || !dismissible || !isTauri()) return;

    const appWindow = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    let disposed = false;

    void appWindow.setAlwaysOnTop(true).catch(() => undefined);
    void appWindow.onFocusChanged(({ payload: focused }) => {
      if (!focused && liveSecondsRef.current > 0) {
        if (suppressRecovery.current) return;
        window.setTimeout(() => {
          void appWindow.setAlwaysOnTop(true).catch(() => undefined);
        }, 120);
      }
    }).then((cleanup) => {
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
  }, [dismissible, preview, sessionId]);

  useEffect(() => {
    if (preview || !isTauri() || !useNativeVideo || phase !== "loop" || !effectiveClip) return;

    const appWindow = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    let disposed = false;
    nativeRecoveryArmed.current = false;
    // Ignore the focus event caused by initially presenting the overlay. Once
    // armed, a later focus event is a reliable signal that macOS has returned
    // from the lock screen and may have discarded the AVPlayerLayer surface.
    const armTimer = window.setTimeout(() => {
      nativeRecoveryArmed.current = true;
    }, 1200);

    void appWindow.onFocusChanged(({ payload: focused }) => {
      if (!focused || !nativeRecoveryArmed.current) return;
      void invoke("update_overlay_media", {
        media: {
          filePath: effectiveClip.filePath,
          format: effectiveClip.format,
          shouldLoop: true,
          nextFilePath: null,
          nextFormat: null
        }
      }).catch(() => undefined);
    }).then((cleanup) => {
      if (disposed) {
        cleanup();
      } else {
        unlisten = cleanup;
      }
    });

    return () => {
      disposed = true;
      window.clearTimeout(armTimer);
      unlisten?.();
    };
  }, [effectiveClip?.filePath, effectiveClip?.format, phase, preview, useNativeVideo]);

  return (
    <div
      className={[
      "overlay",
      preview ? "overlay--preview" : "",
      !preview ? "overlay--live" : "",
        !preview && useNativeVideo ? "overlay--native-transparent" : "",
        useTransparentImageOverlay ? "overlay--native-transparent" : "",
        preview && style === "floating" ? "overlay--preview-floating" : "",
        !preview && style === "floating" ? "overlay--live-floating" : "",
        style === "floating" ? "overlay--floating" : "overlay--immersive"
      ]
        .filter(Boolean)
        .join(" ")}
      onContextMenu={(event) => {
        if (preview || interactions.length === 0 || phase !== "loop" || activeInteraction) return;
        event.preventDefault();
        setInteractionMenu({ x: event.clientX, y: event.clientY });
      }}
      onClick={() => interactionMenu && setInteractionMenu(null)}
    >
      <div className="overlay__surface">
        <div className="overlay__glow" />
        <div className="overlay__media">
          {effectiveClip ? (
            showImagePreview ? (
              previewImageUrl ? (
                <img src={previewImageUrl} alt={asset?.name ?? "scene preview"} className="overlay__preview-image" />
              ) : (
                <div className="overlay__placeholder">正在读取预览图…</div>
              )
            ) : showAnimatedImage ? (
              animatedImageUrl ? (
                <img
                  src={animatedImageUrl}
                  alt={asset?.name ?? "scene preview"}
                  className="overlay__preview-image overlay__animated-image"
                />
              ) : (
                <div className="overlay__placeholder">正在读取动画素材…</div>
              )
            ) : showMovPreviewFallback ? (
              <div className="overlay__placeholder">这支 MOV 会在实际弹出时用原生透明播放</div>
            ) : useNativeVideo ? (
              <div className="overlay__native-stage" aria-hidden="true" />
            ) : useSeamlessHtmlVideoStack && asset ? (
              // 多层 video 叠放：循环始终在播（hidden 时也在解码缓冲），
              // 入场 onEnded 触发可见性翻转，避免任何 unmount/remount 卡顿。
              // 三层各自负责一个 phase；loop 是 base 层永远存在。
              <div className="overlay__video-stack">
                <video
                  key={`${asset.id}-loop-${asset.loopClip.filePath}`}
                  ref={loopVideoRef}
                  src={toMediaUrl(asset.loopClip.filePath)}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload={VIDEO_STACK_PRELOAD}
                  className="overlay__video-stack-layer"
                  style={{ opacity: (phase === "intro" && asset.introClip) || activeInteraction ? 0 : 1 }}
                />
                {asset.introClip ? (
                  <video
                    key={`${asset.id}-intro-${asset.introClip.filePath}`}
                    src={toMediaUrl(asset.introClip.filePath)}
                    autoPlay
                    muted
                    playsInline
                    preload={VIDEO_STACK_PRELOAD}
                    className="overlay__video-stack-layer"
                    style={{
                      opacity: phase === "intro" ? 1 : 0,
                      pointerEvents: "none"
                    }}
                    onEnded={() => {
                      if (phase === "intro") {
                        setPhase("loop");
                      }
                    }}
                  />
                ) : null}
                {asset.outroClip ? (
                  <video
                    key={`${asset.id}-outro-${asset.outroClip.filePath}`}
                    ref={outroVideoRef}
                    src={toMediaUrl(asset.outroClip.filePath)}
                    muted
                    playsInline
                    preload={VIDEO_STACK_PRELOAD}
                    className="overlay__video-stack-layer"
                    style={{
                      opacity: phase === "outro" || phase === "closing" ? 1 : 0,
                      pointerEvents: "none"
                    }}
                    onEnded={() => {
                      if (phase === "outro") {
                        beginClosing();
                      }
                    }}
                  />
                ) : null}
                {interactions.map((interaction) => (
                  <video
                    key={`${asset.id}-interaction-${interaction.id}-${interaction.clip.filePath}`}
                    ref={(node) => {
                      if (node) interactionVideoRefs.current.set(interaction.id, node);
                      else interactionVideoRefs.current.delete(interaction.id);
                    }}
                    src={toMediaUrl(interaction.clip.filePath)}
                    muted
                    playsInline
                    preload={VIDEO_STACK_PRELOAD}
                    className="overlay__video-stack-layer"
                    style={{
                      opacity: activeInteraction?.id === interaction.id ? 1 : 0,
                      pointerEvents: "none"
                    }}
                    onEnded={() => {
                      returnToHtmlLoopStart(interaction.id);
                    }}
                  />
                ))}
              </div>
            ) : effectiveClip.filePath ? (
              <video
                key={`${asset?.id ?? "scene"}-${phase}-${effectiveClip.filePath}`}
                src={toMediaUrl(effectiveClip.filePath)}
                autoPlay
                loop={phase === "loop" && !activeInteraction}
                muted
                playsInline
              />
            ) : (
              <div className="overlay__placeholder">{asset?.name ?? "Scene"}</div>
            )
          ) : preview ? (
            <div className="overlay__placeholder">Pick an asset</div>
          ) : null}
        </div>
        {!preview && phase !== "outro" && phase !== "closing" ? (
          <div
            className={[
              "overlay__hud",
              "overlay-countdown-card",
              `overlay-countdown-card--${countdownMode}`
            ].join(" ")}
            data-countdown-mode={countdownMode}
          >
            <img
              className="overlay-countdown-card__cat"
              src={restPeekingCat}
              alt=""
              aria-hidden="true"
            />
            <div className="overlay-countdown-card__status">
              <span aria-hidden="true" />
              休息中
            </div>
            <p className="overlay-countdown-card__label">休息剩余</p>
            <h3 aria-live={countdownMode === "ending" ? "polite" : "off"}>
              {formatClock(liveSeconds)}
            </h3>
            <div className="overlay-countdown-card__progress">
              <span className="overlay-countdown-card__track" aria-hidden="true">
                <span style={{ width: `${restProgress * 100}%` }} />
              </span>
              <span>{formatClock(remainingSeconds)}</span>
            </div>
            <p className="overlay-countdown-card__prompt">
              <Leaf size={16} strokeWidth={2.2} aria-hidden="true" />
              <span>{restPrompt}</span>
            </p>
            {dismissible ? (
              <button
                type="button"
                className="secondary overlay__dismiss"
                onClick={() => {
                  requestDismiss();
                }}
              >
                {dismissLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {interactionMenu ? (
        <div
          className="overlay__interaction-menu"
          role="menu"
          aria-label="互动动作"
          style={{ left: interactionMenu.x, top: interactionMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <span>互动</span>
          {interactions.map((interaction) => (
            <button
              type="button"
              role="menuitem"
              key={interaction.id}
              onClick={() => {
                const video = interactionVideoRefs.current.get(interaction.id);
                const activate = () => {
                  setActiveInteraction(interaction);
                  if (!video) return;
                  try {
                    video.currentTime = 0;
                  } catch {
                    /* 元数据尚未就绪时，play 会从默认起点开始。 */
                  }
                  void video.play().catch(() => {
                    setActiveInteraction((current) => current?.id === interaction.id ? null : current);
                  });
                };
                if (video && video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
                  video.addEventListener("loadeddata", activate, { once: true });
                  video.load();
                } else {
                  activate();
                }
                setInteractionMenu(null);
              }}
            >
              {interaction.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
