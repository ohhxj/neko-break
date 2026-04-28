import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";
import type { MediaAsset } from "../../domain/media/types";
import { useBreakOverlay } from "./useBreakOverlay";
import { useEffect, useRef } from "react";

type Props = {
  asset: MediaAsset | null;
  remainingSeconds: number;
  message: string;
  preview?: boolean;
  dismissible?: boolean;
};

const formatClock = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

const toMediaUrl = (filePath: string) => {
  if (!filePath) return "";
  if (filePath.startsWith("/") && isTauri()) {
    return convertFileSrc(filePath);
  }
  return filePath;
};

export function BreakOverlay({
  asset,
  remainingSeconds,
  message,
  preview = false,
  dismissible = false
}: Props) {
  const liveSeconds = useBreakOverlay(remainingSeconds);
  const completionHandled = useRef(false);

  useEffect(() => {
    if (preview || completionHandled.current || liveSeconds > 0) return;
    completionHandled.current = true;
    void invoke("hide_overlay").catch(() => undefined);
  }, [liveSeconds, preview]);

  useEffect(() => {
    completionHandled.current = false;
  }, [remainingSeconds]);

  return (
    <div className={preview ? "overlay overlay--preview" : "overlay"}>
      <div className="overlay__glow" />
      <div className="overlay__media">
        {asset ? (
          asset.filePath ? (
            <video src={toMediaUrl(asset.filePath)} autoPlay loop muted playsInline />
          ) : (
            <div className="overlay__placeholder">{asset.name}</div>
          )
        ) : (
          <div className="overlay__placeholder">Pick an asset</div>
        )}
      </div>
      <div className="overlay__hud">
        <p>{message}</p>
        <h3>{formatClock(liveSeconds)}</h3>
        {dismissible ? (
          <button
            type="button"
            className="secondary overlay__dismiss"
            onClick={() => void invoke("hide_overlay").catch(() => undefined)}
          >
            End break
          </button>
        ) : null}
      </div>
    </div>
  );
}
