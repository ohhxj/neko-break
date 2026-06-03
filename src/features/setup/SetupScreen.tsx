import type { MediaAsset } from "../../domain/media/types";
import type { AppSettings } from "../../domain/settings/types";
import { brandName, brandPitch } from "../../domain/brand";

type Props = {
  settings: AppSettings;
  assets: MediaAsset[];
  selectedAssetId: string | null;
  onSave: (settings: AppSettings) => Promise<void>;
  onSelectAsset: (assetId: string) => void;
};

export function SetupScreen({
  settings,
  assets,
  selectedAssetId,
  onSave,
  onSelectAsset
}: Props) {
  return (
    <section className="card stack">
      <div>
        <p className="eyebrow">初次设置</p>
        <h2>先定一个治愈节奏吧</h2>
        <p>
          {brandName} 会先给你一套轻松好上手的默认体验，选一只你喜欢的小猫陪你一起休息。
        </p>
      </div>
      <div className="intro-note">
        <strong>为什么要这样设置</strong>
        <span>{brandPitch}</span>
      </div>
      <div className="asset-grid">
        {assets.map((asset) => (
          <button
            key={asset.id}
            className={selectedAssetId === asset.id ? "asset-card asset-card--selected" : "asset-card"}
            onClick={() => onSelectAsset(asset.id)}
            type="button"
          >
            <strong>{asset.name}</strong>
            <span>
              {asset.introClip && asset.outroClip
                ? "入场、循环、退场都已就绪"
                : asset.introClip
                  ? "带入场动画的休息场景"
                  : asset.outroClip
                    ? "带退场动画的休息场景"
                    : asset.copyTheme ?? "休息一下，恢复元气"}
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() =>
          void onSave({
            ...settings,
            intervalMinutes: 90,
            breakMinutes: 5,
            defaultSceneId: selectedAssetId ?? assets[0]?.id ?? null
          })
        }
      >
        使用推荐设置
      </button>
    </section>
  );
}
