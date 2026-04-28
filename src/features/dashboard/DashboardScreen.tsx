import type { SchedulerSnapshot } from "../../domain/breaks/types";
import type { AppSettings } from "../../domain/settings/types";

type Props = {
  settings: AppSettings;
  scheduler: SchedulerSnapshot;
  onDelay: () => void;
  onPauseToday: () => void;
  onStartBreak: () => void;
};

export function DashboardScreen({
  settings,
  scheduler,
  onDelay,
  onPauseToday,
  onStartBreak
}: Props) {
  return (
    <section className="card stack">
      <div>
        <p className="eyebrow">Today</p>
        <h2>{settings.intervalMinutes}-minute rhythm</h2>
      </div>
      <dl className="stats">
        <div>
          <dt>Break length</dt>
          <dd>{settings.breakMinutes} minutes</dd>
        </div>
        <div>
          <dt>Scheduler state</dt>
          <dd>{scheduler.state}</dd>
        </div>
      </dl>
      <div className="inline-actions">
        <button type="button" onClick={onStartBreak}>Start break now</button>
        <button type="button" onClick={onDelay}>Delay once</button>
        <button type="button" className="secondary" onClick={onPauseToday}>
          Pause today
        </button>
      </div>
    </section>
  );
}
