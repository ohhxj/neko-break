import { useEffect, useState } from "react";
import { Clock3, HeartHandshake, MoonStar, Settings2, X } from "lucide-react";
import type { AppSettings } from "../../domain/settings/types";
import { Button } from "../../components/Button";

type Props = {
  settings: AppSettings;
  onChange: (settings: AppSettings) => Promise<void>;
};

type ScheduleKind = "doNotDisturb" | "companion";

export function SettingsScreen({ settings, onChange }: Props) {
  const [intervalDraft, setIntervalDraft] = useState(String(settings.intervalMinutes));
  const [breakDraft, setBreakDraft] = useState(String(settings.breakMinutes));
  const [editingSchedule, setEditingSchedule] = useState<ScheduleKind | null>(null);
  const [scheduleStartDraft, setScheduleStartDraft] = useState("");
  const [scheduleEndDraft, setScheduleEndDraft] = useState("");
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);

  useEffect(() => {
    setIntervalDraft(String(settings.intervalMinutes));
  }, [settings.intervalMinutes]);

  useEffect(() => {
    setBreakDraft(String(settings.breakMinutes));
  }, [settings.breakMinutes]);

  const commitIntervalMinutes = () => {
    const nextValue = Math.max(15, Number(intervalDraft) || settings.intervalMinutes);
    setIntervalDraft(String(nextValue));
    if (nextValue === settings.intervalMinutes) return;
    void onChange({
      ...settings,
      intervalMinutes: nextValue
    });
  };

  const commitBreakMinutes = () => {
    const nextValue = Math.max(1, Number(breakDraft) || settings.breakMinutes);
    setBreakDraft(String(nextValue));
    if (nextValue === settings.breakMinutes) return;
    void onChange({
      ...settings,
      breakMinutes: nextValue
    });
  };

  const openSchedule = (kind: ScheduleKind) => {
    setEditingSchedule(kind);
    setScheduleStartDraft(
      kind === "doNotDisturb" ? settings.doNotDisturbStart : settings.companionStart
    );
    setScheduleEndDraft(
      kind === "doNotDisturb" ? settings.doNotDisturbEnd : settings.companionEnd
    );
    setScheduleError(null);
  };

  const closeSchedule = () => {
    if (savingSchedule) return;
    setEditingSchedule(null);
    setScheduleError(null);
  };

  const saveSchedule = async () => {
    if (!editingSchedule) return;
    if (!scheduleStartDraft || !scheduleEndDraft || scheduleStartDraft === scheduleEndDraft) {
      setScheduleError("开始时间和结束时间不能相同。");
      return;
    }

    setSavingSchedule(true);
    try {
      await onChange(
        editingSchedule === "doNotDisturb"
          ? {
              ...settings,
              doNotDisturbEnabled: true,
              doNotDisturbStart: scheduleStartDraft,
              doNotDisturbEnd: scheduleEndDraft
            }
          : {
              ...settings,
              companionEnabled: true,
              companionStart: scheduleStartDraft,
              companionEnd: scheduleEndDraft
            }
      );
      setEditingSchedule(null);
    } finally {
      setSavingSchedule(false);
    }
  };

  return (
    <>
      <section className="settings-card">
      <div className="settings-panel settings-panel--rhythm">
        <div className="settings-section__heading">
          <span className="settings-section__icon"><Settings2 aria-hidden="true" /></span>
          <strong>提醒规则</strong>
        </div>
        <div className="settings-control-list">
          <label className="settings-number-card">
            <div>
              <span>休息间隔</span>
            </div>
            <div className="number-control">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={intervalDraft}
                onChange={(event) => setIntervalDraft(event.target.value.replace(/\D/g, ""))}
                onBlur={commitIntervalMinutes}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
              />
              <span>分钟</span>
            </div>
          </label>
          <label className="settings-number-card settings-number-card--accent">
            <div>
              <span>休息时长</span>
            </div>
            <div className="number-control">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={breakDraft}
                onChange={(event) => setBreakDraft(event.target.value.replace(/\D/g, ""))}
                onBlur={commitBreakMinutes}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
              />
              <span>分钟</span>
            </div>
          </label>
          <label className="toggle-field">
            <div>
              <span>开机自动启动</span>
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
          <div className="toggle-field schedule-toggle-field">
            <div>
              <span>免打扰时间</span>
            </div>
            <button type="button" className="schedule-time-button" onClick={() => openSchedule("doNotDisturb")}>
              <MoonStar aria-hidden="true" />
              <span>{settings.doNotDisturbStart}–{settings.doNotDisturbEnd}</span>
            </button>
            <label className="schedule-switch" aria-label="开启免打扰时间">
              <input
                type="checkbox"
                checked={settings.doNotDisturbEnabled}
                onChange={(event) => {
                  if (event.target.checked) {
                    openSchedule("doNotDisturb");
                    return;
                  }
                  void onChange({ ...settings, doNotDisturbEnabled: false });
                }}
              />
              <span className="toggle-switch" aria-hidden="true" />
            </label>
          </div>
          <div className="toggle-field schedule-toggle-field">
            <div>
              <span>陪伴时间</span>
            </div>
            <button type="button" className="schedule-time-button" onClick={() => openSchedule("companion")}>
              <HeartHandshake aria-hidden="true" />
              <span>{settings.companionStart}–{settings.companionEnd}</span>
            </button>
            <label className="schedule-switch" aria-label="开启陪伴时间">
              <input
                type="checkbox"
                checked={settings.companionEnabled}
                onChange={(event) => {
                  if (event.target.checked) {
                    openSchedule("companion");
                    return;
                  }
                  void onChange({ ...settings, companionEnabled: false });
                }}
              />
              <span className="toggle-switch" aria-hidden="true" />
            </label>
          </div>
        </div>
      </div>
      </section>
      {editingSchedule ? (
        <div className="schedule-modal-backdrop" role="presentation" onClick={closeSchedule}>
          <div
            className="schedule-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="schedule-modal__header">
              <div className={editingSchedule === "doNotDisturb" ? "schedule-modal__icon schedule-modal__icon--quiet" : "schedule-modal__icon schedule-modal__icon--companion"}>
                {editingSchedule === "doNotDisturb" ? <MoonStar aria-hidden="true" /> : <HeartHandshake aria-hidden="true" />}
              </div>
              <div>
                <h2 id="schedule-modal-title">
                  {editingSchedule === "doNotDisturb" ? "设置免打扰时间" : "设置陪伴时间"}
                </h2>
                <p>
                  {editingSchedule === "doNotDisturb"
                    ? "在这个时间段内暂停自动休息提醒"
                    : "只在这个时间段内进行自动休息提醒"}
                </p>
              </div>
              <button type="button" className="schedule-modal__close secondary" aria-label="关闭" onClick={closeSchedule}>
                <X aria-hidden="true" />
              </button>
            </header>
            <div className="schedule-time-fields">
              <label>
                <span>开始时间</span>
                <div><Clock3 aria-hidden="true" /><input type="time" value={scheduleStartDraft} onChange={(event) => setScheduleStartDraft(event.target.value)} /></div>
              </label>
              <span className="schedule-time-separator" aria-hidden="true">至</span>
              <label>
                <span>结束时间</span>
                <div><Clock3 aria-hidden="true" /><input type="time" value={scheduleEndDraft} onChange={(event) => setScheduleEndDraft(event.target.value)} /></div>
              </label>
            </div>
            <p className="schedule-modal__note">支持跨天时间段，例如 22:00 至次日 07:00。</p>
            {scheduleError ? <p className="schedule-modal__error">{scheduleError}</p> : null}
            <footer className="schedule-modal__footer">
              <Button type="button" variant="secondary" size="md" disabled={savingSchedule} onClick={closeSchedule}>取消</Button>
              <Button type="button" variant="accent" size="md" disabled={savingSchedule} onClick={() => void saveSchedule()}>
                {savingSchedule ? "正在保存…" : "保存并开启"}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
