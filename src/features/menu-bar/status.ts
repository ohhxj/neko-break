import type { SchedulerSnapshot } from "../../domain/breaks/types";

export const trayPauseMenuLabel = (state: SchedulerSnapshot["state"]) =>
  state === "paused_today" ? "恢复提醒" : "今日暂停";

export const schedulerStateLabel = (state: SchedulerSnapshot["state"]) => {
  if (state === "break_active") return "正在休息";
  if (state === "paused_today") return "今日暂停";
  if (state === "delayed") return "已延后一次";
  if (state === "counting") return "倒计时中";
  return "待开始";
};

export const statusLabel = (snapshot: SchedulerSnapshot) => {
  if (snapshot.state === "paused_today") return "今天先缓一缓";
  if (snapshot.state === "break_active") return "别卷啦，正在休息";
  if (snapshot.state === "delayed") return "下一次休息已延后";
  if (snapshot.nextBreakAt) return `Next break at ${new Date(snapshot.nextBreakAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  })}`;
  return "准备好开始治愈时刻";
};

export const trayTooltipLabel = (snapshot: SchedulerSnapshot) => {
  if (snapshot.state === "paused_today") return "今日提醒已暂停";
  if (snapshot.state === "break_active") return `休息中 · 还剩 ${countdownLabel(snapshot.remainingSeconds)}`;
  if (snapshot.state === "delayed") return `已延后 · ${countdownLabel(snapshot.remainingSeconds)} 后再提醒`;
  if (snapshot.remainingSeconds > 0) return `下次休息还有 ${countdownLabel(snapshot.remainingSeconds)}`;
  return "休息计时器待开始";
};

export const trayTitleLabel = (snapshot: SchedulerSnapshot) => {
  if (snapshot.state === "break_active") return `休息 ${countdownLabel(snapshot.remainingSeconds)}`;
  if (snapshot.state === "paused_today") return "已暂停";
  if (snapshot.remainingSeconds > 0) return countdownLabel(snapshot.remainingSeconds);
  return "喵休息";
};

export const countdownLabel = (seconds: number) => {
  const totalMinutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(totalMinutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};
