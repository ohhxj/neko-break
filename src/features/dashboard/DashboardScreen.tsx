import type { SchedulerSnapshot } from "../../domain/breaks/types";
import type { AppSettings } from "../../domain/settings/types";
import { overlayStyleLabel } from "../../domain/settings/presentation";
import { countdownLabel } from "../menu-bar/status";

type Props = {
  settings: AppSettings;
  scheduler: SchedulerSnapshot;
  onDelay: () => void;
  onPauseToday: () => void;
  onResume: () => void;
  onStartBreak: () => void;
};

const nextActionLabel = (state: SchedulerSnapshot["state"]) => {
  if (state === "break_active") return "小猫已经出来盯你休息啦，先放松一会。";
  if (state === "paused_today") return "今天的提醒先停一下，想继续的时候再打开。";
  if (state === "delayed") return "这次休息已经往后顺延了一小会。";
  return "倒计时结束后，会自动弹出小猫提醒你休息。";
};

export function DashboardScreen({
  settings,
  scheduler,
  onDelay,
  onPauseToday,
  onResume,
  onStartBreak
}: Props) {
  return (
    <section className="card stack">
      <div>
        <p className="eyebrow">今日状态</p>
        <h2>每 {settings.intervalMinutes} 分钟提醒一次</h2>
        <p>{nextActionLabel(scheduler.state)}</p>
      </div>
      <div className="mini-banner">
        <strong>今天也别太累啦</strong>
        <span>休息不是偷懒，是为了让后面的效率更稳一点。</span>
      </div>
      <dl className="stats">
        <div className="stat-card">
          <dt>
            <span className="stat-card__icon stat-card__icon--green">◷</span>
            间隔
          </dt>
          <dd>
            <strong>{settings.intervalMinutes}</strong>
            <span>分钟</span>
          </dd>
        </div>
        <div className="stat-card">
          <dt>
            <span className="stat-card__icon stat-card__icon--purple">☕</span>
            休息
          </dt>
          <dd>
            <strong>{settings.breakMinutes}</strong>
            <span>分钟</span>
          </dd>
        </div>
        <div className="stat-card">
          <dt>
            <span className="stat-card__icon stat-card__icon--blue">⌛</span>
            剩余时间
          </dt>
          <dd>
            <strong>{countdownLabel(scheduler.remainingSeconds)}</strong>
          </dd>
        </div>
        <div className="stat-card">
          <dt>
            <span className="stat-card__icon stat-card__icon--violet">☾</span>
            弹出模式
          </dt>
          <dd>
            <strong>{overlayStyleLabel(settings.overlayStyle)}</strong>
          </dd>
        </div>
      </dl>
      <div className="inline-actions">
        <button type="button" onClick={onStartBreak}>立即休息一下</button>
        {scheduler.state === "paused_today" ? (
          <button type="button" className="secondary" onClick={onResume}>
            恢复提醒
          </button>
        ) : (
          <>
            <button type="button" onClick={onDelay}>延后一次</button>
            <button type="button" className="secondary" onClick={onPauseToday}>
              今日暂停
            </button>
          </>
        )}
      </div>
    </section>
  );
}
