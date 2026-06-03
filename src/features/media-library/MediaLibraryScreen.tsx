import { resolutionLabel } from "../../domain/media/presentation";
import type { MediaAsset, SceneClip } from "../../domain/media/types";
import { convertFileSrc, isTauri } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

type Props = {
  assets: MediaAsset[];
  selectedAssetId: string | null;
  onImport: () => Promise<MediaAsset | null>;
  onSelect: (assetId: string) => void;
  onTestPreview: (asset: MediaAsset) => void;
  onDeleteScene: (asset: MediaAsset) => Promise<void> | void;
  importError: string | null;
  importStatus: string | null;
  onRenameScene: (asset: MediaAsset, name: string) => Promise<void>;
  onUpdateSceneMeta: (
    asset: MediaAsset,
    patch: Pick<MediaAsset, "closeButtonLabel" | "overlayStyleHint">
  ) => Promise<void>;
  onAssignClip: (asset: MediaAsset, slot: "intro" | "loop" | "outro") => Promise<void>;
  onClearClip: (asset: MediaAsset, slot: "intro" | "outro") => Promise<void>;
};

type SceneEditorProps = Pick<
  Props,
  "onRenameScene" | "onUpdateSceneMeta" | "onAssignClip" | "onClearClip" | "onTestPreview" | "onDeleteScene" | "onSelect"
> & {
  asset: MediaAsset | null;
  selectedAssetId: string | null;
  onClose: () => void;
};

const visibleAssetCount = 3;
const clipDisplayName = (clip: SceneClip) => clip.filePath.split("/").pop()?.replace(/\.[^.]+$/, "") ?? clip.id;
const sceneModeLabel = (asset: MediaAsset) => {
  if (asset.introClip && asset.outroClip) return "入场 + 循环 + 退场";
  if (asset.introClip) return "入场 + 循环";
  if (asset.outroClip) return "循环 + 退场";
  return "纯循环";
};

const sceneStyleLabel = (asset: MediaAsset) => {
  if (asset.overlayStyleHint === "floating") return "推荐小窗弹出";
  if (asset.overlayStyleHint === "immersive") return "推荐全屏播放";
  return "跟随全局设置";
};

const sceneCardStatus = (asset: MediaAsset, selectedAssetId: string | null) => {
  if (selectedAssetId === asset.id) return "当前使用";
  if (!asset.outroClip) return "缺少退场";
  if (asset.builtIn) return "已配置";
  return "新添加";
};

const sceneCardStatusTone = (asset: MediaAsset, selectedAssetId: string | null) => {
  if (selectedAssetId === asset.id) return "current";
  if (!asset.outroClip) return "missing";
  if (asset.builtIn) return "configured";
  return "new";
};

const clipStatus = (clip: SceneClip | null, required = false) => {
  if (clip) return "已配置";
  return required ? "未配置" : "可选";
};

const clipDetail = (clip: SceneClip | null) =>
  clip
    ? `${clipDisplayName(clip)} · ${Math.round(clip.durationSeconds * 10) / 10}s`
    : "还没有配置这个片段";

const previewUrl = (asset: MediaAsset) => {
  const previewPath = asset.coverImagePath ?? asset.previewImagePath ?? asset.loopClip.previewImagePath;
  if (!previewPath) return "";
  const looksLikeAbsoluteFilePath =
    previewPath.startsWith("/Users/") ||
    previewPath.startsWith("/private/") ||
    previewPath.startsWith("/var/") ||
    previewPath.startsWith("/Volumes/");
  if (isTauri() && looksLikeAbsoluteFilePath) return convertFileSrc(previewPath);
  return previewPath;
};

export function MediaLibraryScreen({
  assets,
  selectedAssetId,
  onImport,
  onSelect,
  onTestPreview,
  onDeleteScene,
  importError,
  importStatus,
  onRenameScene,
  onUpdateSceneMeta,
  onAssignClip,
  onClearClip
}: Props) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [focusedAssetId, setFocusedAssetId] = useState<string | null>(selectedAssetId);
  const [searchQuery, setSearchQuery] = useState("");
  const selectedAsset =
    assets.find((asset) => asset.id === selectedAssetId) ?? assets[0] ?? null;
  const focusedAsset =
    assets.find((asset) => asset.id === (focusedAssetId ?? selectedAssetId)) ?? selectedAsset;
  const visibleAssets = assets.slice(0, visibleAssetCount);
  const hiddenCount = Math.max(0, assets.length - visibleAssetCount);
  const modalAssets = assets.filter((asset) =>
    asset.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );
  const importAndFocus = async () => {
    const imported = await onImport();
    if (!imported) return;
    setFocusedAssetId(imported.id);
    setLibraryOpen(true);
  };

  useEffect(() => {
    setFocusedAssetId((current) => current ?? selectedAssetId);
  }, [selectedAssetId]);

  return (
    <section className="media-library-panel">
      <div className="media-default-row">
        <div className="media-row-title">
          <span className="settings-section__icon">▣</span>
          <div>
            <strong>默认场景</strong>
            <small className="info-text">休息时自动播放你最爱的猫咪场景</small>
          </div>
        </div>
        <button type="button" className="media-selected-pill" onClick={() => setLibraryOpen(true)}>
          {selectedAsset ? (
            <>
              <AssetThumb asset={selectedAsset} />
              <span>{selectedAsset.name}</span>
            </>
          ) : (
            <span>选择场景</span>
          )}
          <span className="media-chevron">⌄</span>
        </button>
      </div>

      {importStatus ? <p className="info-text">{importStatus}</p> : null}

      <div className="media-strip-row">
        <div className="media-row-title media-row-title--compact">
          <span className="settings-section__icon">▶</span>
          <div>
            <strong>场景库</strong>
            <small className="info-text">共 {assets.length} 个场景</small>
          </div>
        </div>
        <div className="media-strip">
          {visibleAssets.map((asset) => (
            <AssetTile
              key={asset.id}
              asset={asset}
              selected={selectedAssetId === asset.id}
              onSelect={() => {
                setFocusedAssetId(asset.id);
                onSelect(asset.id);
              }}
            />
          ))}
          <button type="button" className="media-add-card" onClick={() => void importAndFocus()}>
            <span>＋</span>
            <small>添加视频</small>
          </button>
          {hiddenCount > 0 ? (
            <button type="button" className="media-more-card" onClick={() => setLibraryOpen(true)}>
              <span>+{hiddenCount}</span>
              <small>更多</small>
            </button>
          ) : null}
        </div>
      </div>

      {importError ? <p className="error-text">{importError}</p> : null}

      {libraryOpen ? (
        <div className="media-modal-backdrop" role="presentation" onClick={() => setLibraryOpen(false)}>
          <div className="media-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <header className="media-modal__header">
              <div>
                <h2>场景库</h2>
                <p className="info-text">管理全部视频场景，选择当前使用的治愈片段</p>
              </div>
              <div className="media-modal__actions">
                <label className="media-search">
                  <span aria-hidden="true">⌕</span>
                  <input
                    type="search"
                    placeholder="搜索场景"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </label>
                <button type="button" className="secondary" onClick={() => void importAndFocus()}>
                  ＋ 添加视频
                </button>
                <button type="button" className="secondary media-modal__close" aria-label="关闭场景库" onClick={() => setLibraryOpen(false)}>
                  ×
                </button>
              </div>
            </header>
            <div className="media-library-dialog">
              <div className="media-modal-grid">
                {modalAssets.map((asset) => (
                  <article
                    key={asset.id}
                    className={[
                      "media-modal-card",
                      selectedAssetId === asset.id ? "media-modal-card--selected" : "",
                      focusedAsset?.id === asset.id ? "media-modal-card--focused" : ""
                    ].filter(Boolean).join(" ")}
                  >
                    <button
                      type="button"
                      className="media-card-face"
                      onClick={() => setFocusedAssetId(asset.id)}
                    >
                      <AssetThumb asset={asset} />
                      <span className={`media-modal-card__status media-modal-card__status--${sceneCardStatusTone(asset, selectedAssetId)}`}>
                        {sceneCardStatus(asset, selectedAssetId)}
                      </span>
                      <span className="media-modal-card__menu" aria-hidden="true">•••</span>
                      <strong>{asset.name}</strong>
                      <span>{sceneModeLabel(asset)} · {Math.round(asset.loopClip.durationSeconds * 10) / 10}s</span>
                    </button>
                    <div className="media-modal-card__actions">
                      <button
                        type="button"
                        className="secondary"
                        disabled={selectedAssetId === asset.id}
                        onClick={() => {
                          setFocusedAssetId(asset.id);
                          onSelect(asset.id);
                        }}
                      >
                        {selectedAssetId === asset.id ? "正在使用" : "设为当前"}
                      </button>
                      <button
                        type="button"
                        className="secondary ghost"
                        onClick={() => {
                          setFocusedAssetId(asset.id);
                          setDetailOpen(true);
                        }}
                      >
                        详情
                      </button>
                    </div>
                  </article>
                ))}
                <button type="button" className="media-modal-add-card" onClick={() => void importAndFocus()}>
                  <span>＋</span>
                  <strong>添加视频</strong>
                  <small>导入后会自动选中新场景</small>
                </button>
              </div>
              <aside className="media-selection-panel">
                <p className="eyebrow">当前选中</p>
                <h3>{focusedAsset?.name ?? "还没有选择场景"}</h3>
                {focusedAsset ? (
                  <>
                    <div className="media-selection-preview">
                      <AssetThumb asset={focusedAsset} />
                      <span>00:05</span>
                    </div>
                    <dl className="media-selection-list">
                      <div>
                        <dt>关闭文案</dt>
                        <dd>{focusedAsset.closeButtonLabel ?? "小猫让开"}</dd>
                      </div>
                      <div>
                        <dt>展示方式</dt>
                        <dd>{sceneStyleLabel(focusedAsset)}</dd>
                      </div>
                      <div>
                        <dt>入场</dt>
                        <dd>{clipStatus(focusedAsset.introClip)} · {clipDetail(focusedAsset.introClip)}</dd>
                      </div>
                      <div>
                        <dt>循环</dt>
                        <dd>已配置 · {clipDetail(focusedAsset.loopClip)}</dd>
                      </div>
                      <div>
                        <dt>退场</dt>
                        <dd>{clipStatus(focusedAsset.outroClip)} · {clipDetail(focusedAsset.outroClip)}</dd>
                      </div>
                    </dl>
                    <div className="media-selection-actions">
                      <button
                        type="button"
                        disabled={selectedAssetId === focusedAsset.id}
                        onClick={() => onSelect(focusedAsset.id)}
                      >
                        {selectedAssetId === focusedAsset.id ? "当前正在使用" : "设为当前使用"}
                      </button>
                      <button type="button" className="secondary" onClick={() => setDetailOpen(true)}>
                        编辑场景信息
                      </button>
                      <button type="button" className="secondary" onClick={() => onTestPreview(focusedAsset)}>
                        ▷ 测试预览
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="info-text">点击左侧任意场景查看详情。</p>
                )}
              </aside>
            </div>
            <footer className="media-modal__footer">
              <span className="info-text">共 {assets.length} 个场景</span>
              <div className="media-modal__footer-actions">
                <button type="button" className="secondary" onClick={() => setLibraryOpen(false)}>取消</button>
              <button type="button" onClick={() => setLibraryOpen(false)}>完成</button>
              </div>
            </footer>
            {detailOpen ? (
              <div className="scene-drawer-backdrop" role="presentation" onClick={() => setDetailOpen(false)}>
                <aside className="scene-drawer" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                  <header className="scene-drawer__header">
                    <div>
                      <p className="eyebrow">场景详情</p>
                      <h2>{focusedAsset?.name ?? "未选择场景"}</h2>
                    </div>
                    <button type="button" className="secondary scene-drawer__close" onClick={() => setDetailOpen(false)}>
                      收起
                    </button>
                  </header>
                  <SceneEditor
                    asset={focusedAsset}
                    onRenameScene={onRenameScene}
                    onUpdateSceneMeta={onUpdateSceneMeta}
                    onAssignClip={onAssignClip}
                    onClearClip={onClearClip}
                    onTestPreview={onTestPreview}
                    onDeleteScene={onDeleteScene}
                    onSelect={onSelect}
                    selectedAssetId={selectedAssetId}
                    onClose={() => setDetailOpen(false)}
                  />
                </aside>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function SceneEditor({
  asset,
  onRenameScene,
  onUpdateSceneMeta,
  onAssignClip,
  onClearClip,
  onTestPreview,
  onDeleteScene,
  onSelect,
  selectedAssetId,
  onClose
}: SceneEditorProps) {
  const [sceneNameDraft, setSceneNameDraft] = useState("");
  const [closeLabelDraft, setCloseLabelDraft] = useState("");

  useEffect(() => {
    setSceneNameDraft(asset?.name ?? "");
    setCloseLabelDraft(asset?.closeButtonLabel ?? "小猫让开");
  }, [asset?.id, asset?.name, asset?.closeButtonLabel]);

  if (!asset) return null;

  return (
    <div className="scene-editor-row">
      <div className="media-row-title">
        <span className="settings-section__icon">✂</span>
        <div>
          <strong>场景片段</strong>
          <small className="info-text">给这个场景配置入场、循环和退场动画</small>
        </div>
      </div>
      <div className="scene-editor-panel">
        <div className="scene-editor-scroll">
        <section className="scene-editor-section">
          <p className="eyebrow">基础信息</p>
        <div className="scene-editor-panel__top">
          <label className="scene-name-field">
            <span className="info-text">场景名称</span>
            <input
              type="text"
              value={sceneNameDraft || asset.name}
              onChange={(event) => setSceneNameDraft(event.target.value)}
              onBlur={() => {
                const nextName = (sceneNameDraft || asset.name).trim();
                if (!nextName || nextName === asset.name) {
                  setSceneNameDraft(asset.name);
                  return;
                }
                void onRenameScene(asset, nextName);
              }}
              disabled={asset.builtIn}
            />
          </label>
          <div className="scene-summary-badges">
            <span className="scene-summary-badge">{sceneModeLabel(asset)}</span>
            <span className="scene-summary-badge">循环 {Math.round(asset.loopClip.durationSeconds * 10) / 10}s</span>
            {asset.introClip ? <span className="scene-summary-badge">有入场</span> : null}
            {asset.outroClip ? <span className="scene-summary-badge">有退场</span> : null}
          </div>
          <div className="scene-meta-grid">
            <label className="scene-name-field">
              <span className="info-text">关闭按钮文案</span>
              <input
                type="text"
                value={closeLabelDraft}
                onChange={(event) => setCloseLabelDraft(event.target.value)}
                onBlur={() => {
                  const nextLabel = closeLabelDraft.trim() || "小猫让开";
                  if (nextLabel === (asset.closeButtonLabel ?? "小猫让开")) {
                    setCloseLabelDraft(asset.closeButtonLabel ?? "小猫让开");
                    return;
                  }
                  void onUpdateSceneMeta(asset, {
                    closeButtonLabel: nextLabel,
                    overlayStyleHint: asset.overlayStyleHint
                  });
                }}
              />
            </label>
            <label className="scene-name-field">
              <span className="info-text">推荐展示方式</span>
              <select
                value={asset.overlayStyleHint ?? "follow"}
                onChange={(event) => {
                  const value = event.target.value;
                  void onUpdateSceneMeta(asset, {
                    closeButtonLabel: closeLabelDraft.trim() || "小猫让开",
                    overlayStyleHint: value === "follow" ? null : (value as "floating" | "immersive")
                  });
                }}
              >
                <option value="follow">跟随全局设置</option>
                <option value="floating">推荐小窗弹出</option>
                <option value="immersive">推荐全屏播放</option>
              </select>
            </label>
          </div>
        </div>
        </section>
        <section className="scene-editor-section">
          <p className="eyebrow">素材片段</p>
        <div className="scene-clip-grid">
          <ClipSlot
            title="入场动画"
            optional
            clip={asset.introClip}
            actionLabel={asset.introClip ? "替换" : "导入"}
            onAction={() => void onAssignClip(asset, "intro")}
            onClear={asset.introClip ? () => void onClearClip(asset, "intro") : undefined}
          />
          <ClipSlot
            title="循环动画"
            clip={asset.loopClip}
            actionLabel="替换"
            onAction={() => void onAssignClip(asset, "loop")}
          />
          <ClipSlot
            title="退场动画"
            optional
            clip={asset.outroClip}
            actionLabel={asset.outroClip ? "替换" : "导入"}
            onAction={() => void onAssignClip(asset, "outro")}
            onClear={asset.outroClip ? () => void onClearClip(asset, "outro") : undefined}
          />
        </div>
        </section>
        <section className="scene-editor-section scene-editor-behavior">
          <p className="eyebrow">展示与行为</p>
          <label className="scene-behavior-row">
            <span>跟随全局弹出方式</span>
            <input
              type="checkbox"
              checked={!asset.overlayStyleHint}
              onChange={(event) =>
                void onUpdateSceneMeta(asset, {
                  closeButtonLabel: closeLabelDraft.trim() || "小猫让开",
                  overlayStyleHint: event.target.checked ? null : "floating"
                })
              }
            />
            <span className="toggle-switch" aria-hidden="true" />
          </label>
          <label className="scene-behavior-row">
            <span>倒计时结束自动关闭</span>
            <input type="checkbox" checked readOnly />
            <span className="toggle-switch" aria-hidden="true" />
          </label>
          <label className="scene-countdown-row">
            <span>倒计时</span>
            <input type="number" min={1} value={5} readOnly />
            <small>秒</small>
          </label>
        </section>
        <section className="scene-editor-section scene-editor-preview">
          <div className="scene-editor-preview__actions">
            <button type="button" className="secondary" onClick={() => onTestPreview(asset)}>
              ▶ 测试此场景
            </button>
            <button
              type="button"
              className="secondary"
              disabled={selectedAssetId === asset.id}
              onClick={() => onSelect(asset.id)}
            >
              ☆ {selectedAssetId === asset.id ? "已经是默认场景" : "设为默认场景"}
            </button>
          </div>
        </section>
        </div>
        <footer className="scene-drawer__footer">
          <button
            type="button"
            className="secondary danger"
            disabled={asset.builtIn}
            onClick={() => {
              if (!window.confirm(`确定删除「${asset.name}」吗？`)) return;
              void Promise.resolve(onDeleteScene(asset)).then(onClose);
            }}
          >
            删除场景
          </button>
          <div>
            <button type="button" className="secondary" onClick={onClose}>
              取消
            </button>
            <button type="button" onClick={onClose}>
              保存场景
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function AssetTile({
  asset,
  selected,
  onSelect
}: {
  asset: MediaAsset;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" className={selected ? "media-tile media-tile--selected" : "media-tile"} onClick={onSelect}>
      <AssetThumb asset={asset} />
      <span>{asset.name}</span>
      <small className="media-tile__meta">{sceneModeLabel(asset)}</small>
    </button>
  );
}

function AssetThumb({ asset }: { asset: MediaAsset }) {
  const url = previewUrl(asset);

  return (
    <span className="media-thumb">
      {url ? <img src={url} alt="" /> : <span className="media-thumb__fallback">喵</span>}
    </span>
  );
}

function ClipSlot({
  title,
  clip,
  optional,
  actionLabel,
  onAction,
  onClear
}: {
  title: string;
  clip: SceneClip | null;
  optional?: boolean;
  actionLabel: string;
  onAction: () => void;
  onClear?: () => void;
}) {
  return (
    <div className="scene-clip-slot">
      <div className="scene-clip-slot__header">
        <strong>{title}</strong>
        {optional ? <small className="info-text">可选</small> : <small className="info-text">必填</small>}
      </div>
      <div className="scene-clip-slot__body">
        {clip ? (
          <>
            <div>
              <p className="scene-clip-slot__name">{clipDisplayName(clip)}</p>
              <small className="info-text">
                {resolutionLabel(clip.pixelWidth, clip.pixelHeight)} · {Math.round(clip.durationSeconds * 10) / 10}s
              </small>
            </div>
            <div className="scene-clip-slot__actions">
              <button type="button" className="secondary" onClick={onAction}>
                {actionLabel}
              </button>
              {onClear ? (
                <button type="button" className="secondary ghost" onClick={onClear}>
                  清空
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <p className="info-text">还没有配置这个片段。</p>
            <button type="button" className="secondary" onClick={onAction}>
              {actionLabel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
