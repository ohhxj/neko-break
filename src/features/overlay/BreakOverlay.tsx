import type { MediaAsset } from "../../domain/media/types";
import { useBreakOverlay } from "./useBreakOverlay";

type Props = {
  asset: MediaAsset | null;
  remainingSeconds: number;
  message: string;
  preview?: boolean;
};

const formatClock = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

export function BreakOverlay({ asset, remainingSeconds, message, preview = false }: Props) {
  const liveSeconds = useBreakOverlay(remainingSeconds);

  return (
    <div className={preview ? "overlay overlay--preview" : "overlay"}>
      <div className="overlay__glow" />
      <div className="overlay__media">
        {asset ? (
          asset.filePath ? (
            <video src={asset.filePath} autoPlay loop muted playsInline />
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
      </div>
    </div>
  );
}
