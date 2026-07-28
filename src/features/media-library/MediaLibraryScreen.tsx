import { resolutionLabel } from "../../domain/media/presentation";
import type { MediaAsset, SceneClip } from "../../domain/media/types";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  isFileSystemPath,
  isMacOSRuntime,
  isWindowsRuntime
} from "../../platform/runtime";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CircleCheck,
  Edit3,
  FlaskConical,
  Heart,
  Info,
  Lightbulb,
  LogIn,
  LogOut,
  MessageCircle,
  Play,
  Plus,
  QrCode,
  RefreshCcw,
  Repeat2,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X
} from "lucide-react";
import { Button } from "../../components/Button";
import { BrandMark } from "../../components/BrandMark";
import wechatGroupQr from "../../assets/community/wechat-group-qr.png";

type Props = {
  assets: MediaAsset[];
  selectedAssetId: string | null;
  onImportClip: () => Promise<SceneClip | null>;
  onCreateScene: (draft: SceneDraft) => Promise<MediaAsset>;
  onSelect: (assetId: string) => void;
  onTestPreview: (asset: MediaAsset) => void;
  onDeleteScene: (asset: MediaAsset) => Promise<void> | void;
  onSupportAuthor?: () => void;
  importError: string | null;
  onRenameScene: (asset: MediaAsset, name: string) => Promise<void>;
  onUpdateSceneMeta: (
    asset: MediaAsset,
    patch: Pick<MediaAsset, "closeButtonLabel">
  ) => Promise<void>;
  onAssignClip: (asset: MediaAsset, slot: "intro" | "loop" | "outro") => Promise<void>;
  onClearClip: (asset: MediaAsset, slot: "intro" | "outro") => Promise<void>;
};

export type SceneDraft = {
  name: string;
  introClip: SceneClip | null;
  loopClip: SceneClip;
  outroClip: SceneClip | null;
};

type SceneSlot = "intro" | "loop" | "outro";
type LibraryFilter = "all" | "active" | "imported";

type SceneEditorProps = Pick<
  Props,
  "onRenameScene" | "onUpdateSceneMeta" | "onAssignClip" | "onClearClip" | "onTestPreview" | "onDeleteScene" | "onSelect"
> & {
  asset: MediaAsset | null;
  selectedAssetId: string | null;
  onClose: () => void;
};

const visibleAssetCount = 3;
const transparentMediaFormatHint = isWindowsRuntime
  ? "Windows 仅支持带透明通道的 WebM 文件"
  : isMacOSRuntime
    ? "macOS 仅支持带 Alpha 通道的 MOV 文件"
    : "macOS 使用 Alpha MOV，Windows 使用透明 WebM";

const clipDisplayName = (clip: SceneClip) => {
  const previewName = clip.previewImagePath?.split("/").pop() ?? "";
  const previewStem = previewName.replace(/-poster-\d+\.png$/i, "");
  if (previewStem && previewStem !== previewName) return previewStem;
  return clip.filePath.split("/").pop()?.replace(/\.[^.]+$/, "") ?? clip.id;
};
const sceneModeLabel = (asset: MediaAsset) => {
  if (asset.introClip && asset.outroClip) return "入场 + 循环 + 退场";
  if (asset.introClip) return "入场 + 循环";
  if (asset.outroClip) return "循环 + 退场";
  return "纯循环";
};

const clipDetail = (clip: SceneClip | null) =>
  clip
    ? `${clipDisplayName(clip)} · ${Math.round(clip.durationSeconds * 10) / 10}s`
    : "未配置";

const previewPathForAsset = (asset: MediaAsset) =>
  asset.loopClip.previewImagePath ?? asset.coverImagePath ?? asset.previewImagePath ?? "";

export function MediaLibraryScreen({
  assets,
  selectedAssetId,
  onImportClip,
  onCreateScene,
  onSelect,
  onTestPreview,
  onDeleteScene,
  onSupportAuthor,
  importError,
  onRenameScene,
  onUpdateSceneMeta,
  onAssignClip,
  onClearClip
}: Props) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [focusedAssetId, setFocusedAssetId] = useState<string | null>(selectedAssetId);
  const [searchQuery, setSearchQuery] = useState("");
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>("all");
  const selectedAsset =
    assets.find((asset) => asset.id === selectedAssetId) ?? assets[0] ?? null;
  const focusedAsset =
    assets.find((asset) => asset.id === (focusedAssetId ?? selectedAssetId)) ?? selectedAsset;
  const visibleAssets = assets.slice(0, visibleAssetCount);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredAssets = assets.filter((asset) => {
    if (libraryFilter === "active" && asset.id !== selectedAssetId) return false;
    if (libraryFilter === "imported" && asset.builtIn) return false;
    if (!normalizedSearchQuery) return true;
    return asset.name.toLowerCase().includes(normalizedSearchQuery);
  });
  useEffect(() => {
    setFocusedAssetId((current) => current ?? selectedAssetId);
  }, [selectedAssetId]);

  useEffect(() => {
    if (!libraryOpen) return;

    const scrollY = window.scrollY;
    const previousBodyStyle = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      overflow: document.body.style.overflow
    };
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.position = previousBodyStyle.position;
      document.body.style.top = previousBodyStyle.top;
      document.body.style.left = previousBodyStyle.left;
      document.body.style.right = previousBodyStyle.right;
      document.body.style.width = previousBodyStyle.width;
      document.body.style.overflow = previousBodyStyle.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [libraryOpen]);

  return (
    <section className="media-library-panel">
      <div className="media-strip-row">
        <div className="media-library-header">
          <div className="media-row-title media-row-title--compact">
            <span className="settings-section__icon">▶</span>
            <div>
              <strong>场景库</strong>
              <small className="info-text">共 {assets.length} 个场景</small>
            </div>
          </div>
          <Button
            type="button"
            className="media-import-button"
            variant="secondary"
            size="sm"
            icon={<Upload aria-hidden="true" />}
            onClick={() => setCreateOpen(true)}
          >
            导入素材
          </Button>
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
          <button type="button" className="media-more-card" onClick={() => setLibraryOpen(true)}>
            <span className="media-more-card__paw" aria-hidden="true" />
            <strong>更多猫咪</strong>
            <small>领取素材</small>
          </button>
        </div>
      </div>

      {importError ? <p className="error-text">{importError}</p> : null}

      {libraryOpen ? (
        <div className="media-modal-backdrop" role="presentation" onClick={() => setLibraryOpen(false)}>
          <div className="media-modal media-modal--library" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <header className="media-modal__header media-library-titlebar">
              <div className="media-library-title">
                <BrandMark className="media-library-title__icon" />
                <div>
                  <h2>场景库</h2>
                  <p className="info-text">管理陪伴场景，导入你喜欢的透明素材</p>
                </div>
              </div>
              <div className="media-modal__actions">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={<X aria-hidden="true" />}
                  className="media-modal__close"
                  aria-label="关闭场景库"
                  onClick={() => setLibraryOpen(false)}
                />
              </div>
            </header>
            <div className="media-library-dialog media-library-dialog--community">
              <section className="media-library-browser">
                <div className="media-library-toolbar">
                  <label className="media-search media-library-search">
                    <Search aria-hidden="true" />
                    <input
                      type="search"
                      placeholder="搜索场景名称"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                    />
                  </label>
                  <div className="media-filter-tabs media-library-filter" role="tablist" aria-label="场景筛选">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={libraryFilter === "all"}
                      className={libraryFilter === "all" ? "media-filter-tabs__item media-filter-tabs__item--active" : "media-filter-tabs__item"}
                      onClick={() => setLibraryFilter("all")}
                    >
                      全部
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={libraryFilter === "active"}
                      className={libraryFilter === "active" ? "media-filter-tabs__item media-filter-tabs__item--active" : "media-filter-tabs__item"}
                      onClick={() => setLibraryFilter("active")}
                    >
                      使用中
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={libraryFilter === "imported"}
                      className={libraryFilter === "imported" ? "media-filter-tabs__item media-filter-tabs__item--active" : "media-filter-tabs__item"}
                      onClick={() => setLibraryFilter("imported")}
                    >
                      我的导入
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="accent"
                    size="sm"
                    icon={<Plus aria-hidden="true" />}
                    className="media-library-add-button"
                    onClick={() => setCreateOpen(true)}
                  >
                    添加场景
                  </Button>
                </div>
                {filteredAssets.length > 0 ? (
                  <div className="media-modal-grid media-modal-grid--library">
                    {filteredAssets.map((asset) => (
                      <article
                        key={asset.id}
                        className={[
                          "media-modal-card",
                          "media-modal-card--library",
                          selectedAssetId === asset.id ? "media-modal-card--selected" : ""
                        ].filter(Boolean).join(" ")}
                      >
                        {selectedAssetId === asset.id ? <span className="media-modal-card__status">当前使用</span> : null}
                        <button
                          type="button"
                          className="media-card-face"
                          onClick={() => {
                            setFocusedAssetId(asset.id);
                            setDetailOpen(true);
                          }}
                        >
                          <AssetThumb asset={asset} />
                          <strong title={asset.name}>{asset.name}</strong>
                        </button>
                        <div className="media-modal-card__actions">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={selectedAssetId === asset.id}
                            onClick={() => {
                              setFocusedAssetId(asset.id);
                              onSelect(asset.id);
                            }}
                          >
                            {selectedAssetId === asset.id ? "使用中" : "设为当前"}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            icon={<Edit3 aria-hidden="true" />}
                            onClick={() => {
                              setFocusedAssetId(asset.id);
                              setDetailOpen(true);
                            }}
                          >
                            编辑
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="media-library-empty">
                    <QrCode aria-hidden="true" />
                    <strong>没有找到对应场景</strong>
                    <span>换个关键词，或直接添加新的陪伴场景。</span>
                  </div>
                )}
              </section>
              <aside className="media-library-community" aria-label="社群与作者">
                <div className="community-card community-card--qr">
                  <span className="community-card__icon" aria-hidden="true"><Users /></span>
                  <h3>加入猫猫休息搭子共创群</h3>
                  <p>领取更多陪伴素材，参与后续功能内测。</p>
                  <div className="community-qr-placeholder community-qr" aria-label="微信社群二维码">
                    <img src={wechatGroupQr} alt="加入 Neko Break 素材共创群二维码" />
                  </div>
                </div>
                <div className="community-card community-card--benefits">
                  <h3>进群后可以</h3>
                  <ul className="community-benefits">
                    <li><Sparkles aria-hidden="true" /><span>教你生成自己的电子小猫</span></li>
                    <li><FlaskConical aria-hidden="true" /><span>我制作的小猫素材分享</span></li>
                    <li><MessageCircle aria-hidden="true" /><span>我更新的新版客户端</span></li>
                  </ul>
                </div>
                <div className="community-author">
                  <BrandMark className="community-author__icon" />
                  <div>
                    <strong>作者：小水</strong>
                    <span>独立制作，持续更新</span>
                  </div>
                  {onSupportAuthor ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={<Heart aria-hidden="true" />}
                      onClick={() => {
                        setLibraryOpen(false);
                        onSupportAuthor();
                      }}
                    >
                      支持作者
                    </Button>
                  ) : null}
                </div>
              </aside>
            </div>
            {detailOpen ? (
              <div className="scene-drawer-backdrop" role="presentation" onClick={() => setDetailOpen(false)}>
                <aside className="scene-drawer" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                  <header className="scene-drawer__header">
                    <div>
                      <p className="eyebrow">编辑场景</p>
                      <h2>{focusedAsset?.name ?? "未选择场景"}</h2>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      className="scene-drawer__close"
                      onClick={() => setDetailOpen(false)}
                    >
                      收起
                    </Button>
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
      {createOpen ? (
        <CreateSceneModal
          onClose={() => setCreateOpen(false)}
          onImportClip={onImportClip}
          onCreate={async (draft) => {
            const scene = await onCreateScene(draft);
            setFocusedAssetId(scene.id);
            setCreateOpen(false);
            setLibraryOpen(true);
          }}
        />
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
                    closeButtonLabel: nextLabel
                  });
                }}
              />
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
        <section className="scene-editor-section scene-editor-preview">
          <div className="scene-editor-preview__actions">
            <Button
              type="button"
              variant="secondary"
              size="md"
              icon={<Play aria-hidden="true" />}
              onClick={() => onTestPreview(asset)}
            >
              测试此场景
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="md"
              disabled={selectedAssetId === asset.id}
              onClick={() => onSelect(asset.id)}
            >
              {selectedAssetId === asset.id ? "已经是默认场景" : "设为默认场景"}
            </Button>
          </div>
        </section>
        </div>
        <footer className="scene-drawer__footer">
          <Button
            type="button"
            variant="danger"
            size="md"
            icon={<Trash2 aria-hidden="true" />}
            disabled={asset.builtIn}
            onClick={() => {
              if (!window.confirm(`确定删除「${asset.name}」吗？`)) return;
              void Promise.resolve(onDeleteScene(asset)).then(onClose);
            }}
          >
            删除场景
          </Button>
          <div>
            <Button type="button" variant="secondary" size="md" onClick={onClose}>
              取消
            </Button>
            <Button type="button" variant="accent" size="md" icon={<Check aria-hidden="true" />} onClick={onClose}>
              保存场景
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function CreateSceneModal({
  onClose,
  onImportClip,
  onCreate
}: {
  onClose: () => void;
  onImportClip: () => Promise<SceneClip | null>;
  onCreate: (draft: SceneDraft) => Promise<void>;
}) {
  const [sceneName, setSceneName] = useState("");
  const [activeSlot, setActiveSlot] = useState<SceneSlot>("loop");
  const [introClip, setIntroClip] = useState<SceneClip | null>(null);
  const [loopClip, setLoopClip] = useState<SceneClip | null>(null);
  const [outroClip, setOutroClip] = useState<SceneClip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const clips: Record<SceneSlot, SceneClip | null> = {
    intro: introClip,
    loop: loopClip,
    outro: outroClip
  };
  const activeClip = clips[activeSlot];
  const previewClip = loopClip ?? activeClip;

  const assignClip = (slot: SceneSlot, clip: SceneClip | null) => {
    if (slot === "intro") setIntroClip(clip);
    if (slot === "loop") setLoopClip(clip);
    if (slot === "outro") setOutroClip(clip);
  };

  const importForActiveSlot = async () => {
    setBusy(true);
    setError(null);
    try {
      const clip = await onImportClip();
      if (!clip) return;
      assignClip(activeSlot, clip);
      if (!sceneName.trim() && activeSlot === "loop") {
        setSceneName(clipDisplayName(clip));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "素材导入失败，请重新选择。 ");
    } finally {
      setBusy(false);
    }
  };

  const createScene = async () => {
    if (!loopClip || !sceneName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate({
        name: sceneName.trim(),
        introClip,
        loopClip,
        outroClip
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "场景创建失败，请稍后再试。 ");
      setBusy(false);
    }
  };

  return (
    <div className="scene-create-backdrop" role="presentation" onClick={onClose}>
      <div
        className="scene-create-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scene-create-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="scene-create-header">
          <div>
            <h2 id="scene-create-title">添加陪伴场景</h2>
          </div>
          <button type="button" className="scene-create-close secondary" aria-label="关闭" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </header>

        <section className="scene-create-section scene-create-info">
          <label className="scene-create-name">
            <span>场景名称</span>
            <input
              type="text"
              value={sceneName}
              placeholder="例如：蓝白小伙伴"
              maxLength={40}
              onChange={(event) => setSceneName(event.target.value)}
            />
          </label>
        </section>

        <section className="scene-create-section scene-create-materials">
          <div className="scene-create-section__heading">
            <strong>场景素材</strong>
          </div>
          <div className="scene-create-tabs" role="tablist" aria-label="场景素材分类">
            <CreateSceneTab
              label="循环素材"
              meta={loopClip ? "✓" : "必需"}
              active={activeSlot === "loop"}
              complete={Boolean(loopClip)}
              onClick={() => setActiveSlot("loop")}
            />
            <CreateSceneTab
              label="入场素材"
              meta={introClip ? "✓" : "可选"}
              active={activeSlot === "intro"}
              complete={Boolean(introClip)}
              onClick={() => setActiveSlot("intro")}
            />
            <CreateSceneTab
              label="退场素材"
              meta={outroClip ? "✓" : "可选"}
              active={activeSlot === "outro"}
              complete={Boolean(outroClip)}
              onClick={() => setActiveSlot("outro")}
            />
          </div>
          <div className="scene-create-format-note" role="note">
            <Info aria-hidden="true" />
            <strong>仅支持透明背景素材</strong>
            <span>{transparentMediaFormatHint}</span>
          </div>

          <div className="scene-create-workspace">
            <div className="scene-create-editor">
              <div className="scene-create-column-title">
                <strong>当前素材：{activeSlot === "loop" ? "循环" : activeSlot === "intro" ? "入场" : "退场"}</strong>
                <span className={activeSlot === "loop" ? "scene-required-badge" : "scene-optional-badge"}>
                  {activeSlot === "loop" ? "必需" : "可选"}
                </span>
              </div>
              {activeClip ? (
                <div className="scene-uploaded-card">
                  <div className="scene-uploaded-preview">
                    <PreviewImage previewPath={activeClip.previewImagePath ?? ""} />
                  </div>
                  <div className="scene-uploaded-meta">
                    <strong>{clipDisplayName(activeClip)}</strong>
                    <span><CircleCheck aria-hidden="true" />上传完成</span>
                  </div>
                  <div className="scene-uploaded-actions">
                    <button type="button" className="secondary" disabled={busy} onClick={() => void importForActiveSlot()}>
                      <RefreshCcw aria-hidden="true" />
                      <span>替换</span>
                    </button>
                    <button type="button" className="secondary danger" disabled={busy} onClick={() => assignClip(activeSlot, null)}>
                      <Trash2 aria-hidden="true" />
                      <span>删除</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="scene-upload-empty" disabled={busy} onClick={() => void importForActiveSlot()}>
                  <span className="scene-upload-empty__icon" aria-hidden="true">＋</span>
                  <strong>{busy ? "正在导入…" : `选择${activeSlot === "loop" ? "循环" : activeSlot === "intro" ? "入场" : "退场"}视频`}</strong>
                  <small>{activeSlot === "loop" ? "循环素材是创建场景的必需内容" : "可以稍后补充此阶段素材"}</small>
                </button>
              )}
            </div>

            <div className="scene-create-preview-column">
              <div className="scene-create-column-title">
                <strong>完整场景预览</strong>
              </div>
              <div className="scene-create-preview">
                {previewClip ? (
                  <PreviewImage previewPath={previewClip.previewImagePath ?? ""} />
                ) : (
                  <div className="scene-create-preview__empty">上传循环素材后显示场景预览</div>
                )}
              </div>
              <div className="scene-flow" aria-label="场景素材完成状态">
                <SceneFlowItem slot="intro" label="入场" complete={Boolean(introClip)} />
                <ArrowRight className="scene-flow__arrow" aria-hidden="true" />
                <SceneFlowItem slot="loop" label="循环" complete={Boolean(loopClip)} required />
                <ArrowRight className="scene-flow__arrow" aria-hidden="true" />
                <SceneFlowItem slot="outro" label="退场" complete={Boolean(outroClip)} />
              </div>
            </div>
          </div>
        </section>

        {error ? <p className="scene-create-error">{error}</p> : null}
        <footer className="scene-create-footer">
          <p><Lightbulb aria-hidden="true" />仅配置循环素材也可以创建，入场和退场可稍后补充</p>
          <div>
            <button type="button" className="secondary" disabled={busy} onClick={onClose}>取消</button>
            <button type="button" disabled={busy || !loopClip || !sceneName.trim()} onClick={() => void createScene()}>
              {busy ? "正在创建…" : "创建场景"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function CreateSceneTab({
  label,
  meta,
  active,
  complete,
  onClick
}: {
  label: string;
  meta: string;
  active: boolean;
  complete: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={[
        "scene-create-tab",
        active ? "scene-create-tab--active" : "",
        complete ? "scene-create-tab--complete" : ""
      ].filter(Boolean).join(" ")}
      onClick={onClick}
    >
      <strong>{label}</strong>
      <span>{meta === "✓" ? <Check aria-label="已上传" /> : meta}</span>
    </button>
  );
}

function SceneFlowItem({
  slot,
  label,
  complete,
  required = false
}: {
  slot: SceneSlot;
  label: string;
  complete: boolean;
  required?: boolean;
}) {
  const Icon = slot === "intro" ? LogIn : slot === "loop" ? Repeat2 : LogOut;
  return (
    <div className={complete ? "scene-flow__item scene-flow__item--complete" : "scene-flow__item"}>
      <span aria-hidden="true"><Icon /></span>
      <strong>{label}</strong>
      <small>{complete ? "已完成" : required ? "待上传" : "待添加"}</small>
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
    </button>
  );
}

function AssetThumb({ asset }: { asset: MediaAsset }) {
  const previewPath = previewPathForAsset(asset);
  return <PreviewImage previewPath={previewPath} />;
}

function PreviewImage({ previewPath }: { previewPath: string }) {
  const [url, setUrl] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadFailed(false);
    setUrl("");

    if (!previewPath) return;

    if (isTauri() && isFileSystemPath(previewPath)) {
      void invoke<string>("load_preview_image", { filePath: previewPath })
        .then((dataUrl) => {
          if (!cancelled) {
            setUrl(dataUrl);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLoadFailed(true);
          }
        });
      return () => {
        cancelled = true;
      };
    }

    setUrl(previewPath);
  }, [previewPath]);

  return (
    <span className="media-thumb">
      {url && !loadFailed ? (
        <img src={url} alt="" onError={() => setLoadFailed(true)} />
      ) : (
        <span className="media-thumb__fallback">无封面</span>
      )}
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
            <p className="info-text">未配置</p>
            <button type="button" className="secondary" onClick={onAction}>
              {actionLabel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
