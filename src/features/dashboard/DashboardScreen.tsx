import type { CSSProperties } from "react";
import type { SchedulerSnapshot } from "../../domain/breaks/types";
import type { AppSettings } from "../../domain/settings/types";
import { countdownLabel } from "../menu-bar/status";
import { Button } from "../../components/Button";
import { Clock3, Coffee, Pause, Play } from "lucide-react";
import dashboardFocusCat from "../../assets/dashboard-focus-cat.png";

type Props = {
  settings: AppSettings;
  scheduler: SchedulerSnapshot;
  onPauseToday: () => void;
  onResume: () => void;
};

const statusPresentation = (state: SchedulerSnapshot["state"]) => {
  if (state === "break_active") return { label: "休息中", tone: "rest" };
  if (state === "paused_today") return { label: "已暂停", tone: "paused" };
  if (state === "quiet_hours") return { label: "免打扰", tone: "quiet" };
  if (state === "outside_companion_hours") return { label: "待开始", tone: "waiting" };
  if (state === "delayed") return { label: "已延后", tone: "delayed" };
  return { label: "工作中", tone: "working" };
};

const companionPresentation = (state: SchedulerSnapshot["state"]) => {
  if (state === "break_active") return ["小猫陪你认真休息中", "放松一下，短暂离开屏幕吧～"];
  if (state === "paused_today") return ["今天的提醒已经暂停", "恢复后，小猫会继续陪着你"];
  if (state === "quiet_hours") return ["小猫现在不会打扰你", "免打扰结束后会继续计时"];
  if (state === "outside_companion_hours") return ["还没到今天的陪伴时间", "开始后会自动继续计时"];
  if (state === "delayed") return ["小猫等你忙完这一会", "延后结束后会再次提醒你"];
  return ["小猫陪你专注中", "专注是为了更好地休息呀～"];
};

const targetTimeLabel = (remainingSeconds: number) => {
  const target = new Date(Date.now() + Math.max(0, remainingSeconds) * 1000);
  return `${String(target.getHours()).padStart(2, "0")}:${String(target.getMinutes()).padStart(2, "0")}`;
};

export function DashboardScreen({
  settings,
  scheduler,
  onPauseToday,
  onResume
}: Props) {
  const status = statusPresentation(scheduler.state);
  const companion = companionPresentation(scheduler.state);
  const isBreakActive = scheduler.state === "break_active";
  const totalSeconds = Math.max(1, (isBreakActive ? settings.breakMinutes : settings.intervalMinutes) * 60);
  const elapsedPercent = Math.min(100, Math.max(4, (1 - scheduler.remainingSeconds / totalSeconds) * 100));
  const progressStyle = { "--dashboard-progress": `${elapsedPercent}%` } as CSSProperties;

  return (
    <section className="card stack dashboard-rhythm-card">
      <div className="dashboard-rhythm-header">
        <h2>今日节奏</h2>
        <span className={`dashboard-status dashboard-status--${status.tone}`}>{status.label}</span>
      </div>
      <div
        className="dashboard-focus-stage"
        style={progressStyle}
        aria-label={`${isBreakActive ? "本次休息" : "距离下一次休息"}还剩 ${countdownLabel(scheduler.remainingSeconds)}`}
      >
        <img className="dashboard-focus-cat" src={dashboardFocusCat} alt="趴在桌边陪你专注的小猫" />
        <div className="dashboard-countdown-card">
          <span className="dashboard-countdown-label">{isBreakActive ? "本次休息还剩" : "距离下一次休息还有"}</span>
          <strong>{countdownLabel(scheduler.remainingSeconds)}</strong>
          <div className="dashboard-next-time">
            <span>{isBreakActive ? "休息结束" : "下一次休息"}</span>
            <b>{targetTimeLabel(scheduler.remainingSeconds)}</b>
          </div>
          <div className="dashboard-progress" aria-hidden="true"><span /></div>
          <div className="dashboard-cycle-summary">
            <span className="dashboard-cycle-summary__work"><Clock3 aria-hidden="true" />工作 <b>{settings.intervalMinutes}</b> 分钟</span>
            <i aria-hidden="true" />
            <span className="dashboard-cycle-summary__rest"><Coffee aria-hidden="true" />休息 <b>{settings.breakMinutes}</b> 分钟</span>
          </div>
        </div>
      </div>
      <div className="dashboard-focus-message">
        <strong>{companion[0]} <span aria-hidden="true">♥</span></strong>
        <small>{companion[1]}</small>
      </div>
      <dl className="stats">
        <div className="stat-card">
          <dt>
            <span className="stat-card__icon stat-card__icon--green"><Clock3 aria-hidden="true" /></span>
            工作时长
          </dt>
          <dd>
            <strong>{settings.intervalMinutes}</strong>
            <span>分钟</span>
          </dd>
        </div>
        <div className="stat-card">
          <dt>
            <span className="stat-card__icon stat-card__icon--purple"><Coffee aria-hidden="true" /></span>
            休息时长
          </dt>
          <dd>
            <strong>{settings.breakMinutes}</strong>
            <span>分钟</span>
          </dd>
        </div>
      </dl>
      <div className="inline-actions">
        {scheduler.state === "paused_today" ? (
          <Button type="button" variant="primary" size="lg" icon={<Play aria-hidden="true" />} onClick={onResume}>
            恢复提醒
          </Button>
        ) : (
          <Button type="button" variant="warning" size="lg" icon={<Pause aria-hidden="true" />} onClick={onPauseToday}>
            暂停今日提醒
          </Button>
        )}
      </div>
    </section>
  );
}
