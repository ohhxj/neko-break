import { BrandMark } from "../../components/BrandMark";
import type { AppSettings } from "../../domain/settings/types";
import { overlayStyleLabel } from "../../domain/settings/presentation";

type Props = {
  settings: AppSettings;
  onChange: (settings: AppSettings) => Promise<void>;
};

export function SettingsScreen({ settings, onChange }: Props) {
  const selectStyle = (overlayStyle: AppSettings["overlayStyle"]) =>
    void onChange({
      ...settings,
      overlayStyle
    });

  return (
    <section className="settings-card">
      <div className="settings-panel settings-panel--rhythm">
        <div className="settings-section__heading">
          <span className="settings-section__icon">⚙</span>
          <strong>提醒规则</strong>
        </div>
        <div className="settings-control-list">
          <label className="settings-number-card">
            <div>
              <span>休息间隔</span>
              <small className="info-text">每隔多久提醒我休息一次</small>
            </div>
            <div className="number-control">
              <input
                type="number"
                min={15}
                value={settings.intervalMinutes}
                onChange={(event) =>
                  void onChange({
                    ...settings,
                    intervalMinutes: Number(event.target.value)
                  })
                }
              />
              <span>分钟</span>
            </div>
          </label>
          <label className="settings-number-card settings-number-card--accent">
            <div>
              <span>休息时长</span>
              <small className="info-text">每次提醒休息多久</small>
            </div>
            <div className="number-control">
              <input
                type="number"
                min={1}
                value={settings.breakMinutes}
                onChange={(event) =>
                  void onChange({
                    ...settings,
                    breakMinutes: Number(event.target.value)
                  })
                }
              />
              <span>分钟</span>
            </div>
          </label>
          <label className="toggle-field">
            <div>
              <span>开机自动启动</span>
              <small className="info-text">登录后自动启动 Neko Break</small>
            </div>
            <input
              type="checkbox"
              checked={settings.launchAtLogin}
              onChange={(event) =>
                void onChange({
                  ...settings,
                  launchAtLogin: event.target.checked
                })
              }
            />
            <span className="toggle-switch" aria-hidden="true" />
          </label>
        </div>
      </div>

      <div className="settings-panel">
        <div className="settings-section__heading">
          <span className="settings-section__icon">▧</span>
          <strong>弹出方式</strong>
        </div>
        <div className="style-options">
          <button
            type="button"
            className={settings.overlayStyle === "floating" ? "style-option style-option--selected" : "style-option"}
            onClick={() => selectStyle("floating")}
          >
            <span className="style-option__check">{settings.overlayStyle === "floating" ? "已选" : "可选"}</span>
            <div className="style-option__preview style-option__preview--floating">
              <div className="style-option__dock">
                <span className="style-option__mini-window">
                  <BrandMark className="style-option__preview-icon style-option__preview-icon--floating" />
                </span>
                <span>00:05</span>
              </div>
            </div>
            <strong>{overlayStyleLabel("floating")}</strong>
            <span>右下角轻提醒，温柔打断一下</span>
          </button>
          <button
            type="button"
            className={settings.overlayStyle === "immersive" ? "style-option style-option--selected" : "style-option"}
            onClick={() => selectStyle("immersive")}
          >
            <span className="style-option__check">{settings.overlayStyle === "immersive" ? "已选" : "可选"}</span>
            <div className="style-option__preview style-option__preview--immersive">
              <span className="style-option__immersive-card" />
              <span className="style-option__immersive-badge">
                <BrandMark className="style-option__preview-icon style-option__preview-icon--immersive" />
              </span>
              <span>Pause</span>
            </div>
            <strong>{overlayStyleLabel("immersive")}</strong>
            <span>沉浸式休息，更适合彻底切换状态</span>
          </button>
        </div>
      </div>
    </section>
  );
}
