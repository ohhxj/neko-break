import { Cat, CheckCircle2, Clock3, Fish, RotateCcw } from "lucide-react";
import { summarizeBreakHistory } from "../../domain/break-history/summary";
import type { BreakRecord } from "../../domain/break-history/types";

type Props = {
  records: BreakRecord[];
};

const durationLabel = (seconds: number) => {
  if (seconds <= 0) return "0 分钟";
  if (seconds < 60) return "<1 分钟";
  return `${Math.floor(seconds / 60)} 分钟`;
};

const recordTimeLabel = (occurredAt: string) =>
  new Date(occurredAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

export function RestHistoryPanel({ records }: Props) {
  const summary = summarizeBreakHistory(records, new Date());
  const completedUntilReward = 4 - (summary.completedCount % 4);

  return (
    <section className="rest-history-card" aria-labelledby="rest-history-title">
      <header className="rest-history-card__header">
        <h2 id="rest-history-title">今日休息记录</h2>
        <strong>共 {summary.completedCount + summary.deferredCount} 次</strong>
      </header>

      <div className="rest-history-metrics">
        <article>
          <span className="rest-history-metric-icon rest-history-metric-icon--completed"><CheckCircle2 /></span>
          <div><span>已完成</span><strong>{summary.completedCount} 次</strong></div>
        </article>
        <article>
          <span className="rest-history-metric-icon rest-history-metric-icon--time"><Clock3 /></span>
          <div><span>实际休息</span><strong>{durationLabel(summary.actualSeconds)}</strong></div>
        </article>
        <article>
          <span className="rest-history-metric-icon rest-history-metric-icon--deferred"><RotateCcw /></span>
          <div><span>延后</span><strong>{summary.deferredCount} 次</strong></div>
        </article>
      </div>

      <div className="rest-history-list">
        {summary.recentRecords.length > 0 ? summary.recentRecords.map((record) => (
          <div className="rest-history-row" key={record.sessionId}>
            <time>{recordTimeLabel(record.occurredAt)}</time>
            <span className={record.outcome === "completed" ? "is-completed" : "is-deferred"}>
              {record.outcome === "completed" ? <CheckCircle2 /> : <RotateCcw />}
              {record.outcome === "completed" ? "已完成休息" : "提前结束，延后一次"}
            </span>
            <small>实际休息 {durationLabel(record.actualSeconds)}</small>
          </div>
        )) : (
          <p className="rest-history-empty">今天完成或延后的休息会记录在这里。</p>
        )}
      </div>

      <div className="rest-history-reward" title={`猫咪状态：精神不错，今天再完成 ${completedUntilReward} 次完整休息，就可以获得一条小鱼干奖励`}>
        <span className="rest-history-reward__cat"><Cat aria-hidden="true" /></span>
        <p><strong>猫咪状态：</strong>精神不错，今天再完成 {completedUntilReward} 次完整休息，就可以获得一条小鱼干奖励</p>
        <Fish aria-hidden="true" />
      </div>
    </section>
  );
}
