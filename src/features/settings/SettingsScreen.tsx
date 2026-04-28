import type { AppSettings } from "../../domain/settings/types";

type Props = {
  settings: AppSettings;
  onChange: (settings: AppSettings) => Promise<void>;
};

export function SettingsScreen({ settings, onChange }: Props) {
  return (
    <section className="card stack">
      <div>
        <p className="eyebrow">Settings</p>
        <h2>Reminder preferences</h2>
      </div>
      <label className="field">
        <span>Break interval</span>
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
      </label>
      <label className="field">
        <span>Break length</span>
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
      </label>
    </section>
  );
}
