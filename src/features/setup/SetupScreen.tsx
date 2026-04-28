import type { MediaAsset } from "../../domain/media/types";
import type { AppSettings } from "../../domain/settings/types";

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
        <p className="eyebrow">First Run</p>
        <h2>Set your rest rhythm</h2>
        <p>
          Pick a default media asset now. You can swap it later from the media
          library.
        </p>
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
            <span>{asset.copyTheme ?? "Break time"}</span>
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
            defaultAssetId: selectedAssetId ?? assets[0]?.id ?? null
          })
        }
      >
        Use recommended setup
      </button>
    </section>
  );
}
