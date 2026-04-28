import { assetLabel } from "../../domain/media/presentation";
import type { MediaAsset } from "../../domain/media/types";

type Props = {
  assets: MediaAsset[];
  selectedAssetId: string | null;
  onImport: () => Promise<void>;
  onSelect: (assetId: string) => void;
  importError: string | null;
};

export function MediaLibraryScreen({
  assets,
  selectedAssetId,
  onImport,
  onSelect,
  importError
}: Props) {
  return (
    <section className="card stack">
      <header className="section-header">
        <div>
          <p className="eyebrow">Assets</p>
          <h2>Media library</h2>
        </div>
        <button type="button" onClick={() => void onImport()}>
          Import transparent media
        </button>
      </header>
      <ul className="media-list">
        {assets.map((asset) => (
          <li key={asset.id}>
            <button
              type="button"
              className={selectedAssetId === asset.id ? "media-item media-item--selected" : "media-item"}
              onClick={() => onSelect(asset.id)}
            >
              <strong>{asset.name}</strong>
              <span>{assetLabel(asset)}</span>
            </button>
          </li>
        ))}
      </ul>
      {importError ? <p className="error-text">{importError}</p> : null}
    </section>
  );
}
