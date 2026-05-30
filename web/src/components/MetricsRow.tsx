import { TrendingUp, Target, CheckCircle2, XCircle } from "lucide-react";
import { scoreColor, scoreLabel } from "@/lib/utils";
import type { ScoreResult } from "@/lib/types";

interface MetricsRowProps {
  score: ScoreResult;
  respondedCount: number;
  failedCount: number;
}

export function MetricsRow({ score, respondedCount, failedCount }: MetricsRowProps) {
  const color = scoreColor(score.visibility_score);
  const label = scoreLabel(score.visibility_score);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Visibility Score */}
      <div className="col-span-2 lg:col-span-1 rounded-xl border border-border bg-canvas-subtle p-5 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-5"
          style={{ background: `radial-gradient(circle at 80% 50%, ${color}, transparent 70%)` }}
        />
        <p className="text-xs font-medium text-fg-muted uppercase tracking-wider mb-2">
          Visibility Score
        </p>
        <div className="flex items-end gap-2">
          <span
            className="text-6xl font-bold font-mono leading-none tabular-nums"
            style={{ color }}
          >
            {score.visibility_score}
          </span>
          <span className="text-lg text-fg-muted mb-1">/100</span>
        </div>
        <p className="mt-2 text-xs font-medium" style={{ color }}>
          {label}
        </p>
      </div>

      {/* Mention Rate */}
      <MetricCard
        icon={<Target className="w-4 h-4" />}
        label="Mention Rate"
        value={`${(score.mention_rate * 100).toFixed(0)}%`}
        sub={`${score.components.mention_count} of ${score.components.total_responses} responses`}
        iconColor="text-accent-blue"
      />

      {/* Responses */}
      <MetricCard
        icon={<CheckCircle2 className="w-4 h-4" />}
        label="Responses"
        value={String(respondedCount)}
        sub="Successful engine responses"
        iconColor="text-accent-green"
      />

      {/* Failed */}
      <MetricCard
        icon={<XCircle className="w-4 h-4" />}
        label="Failed / Skipped"
        value={String(failedCount)}
        sub={failedCount === 0 ? "All engines responded" : "Check raw responses"}
        iconColor={failedCount > 0 ? "text-accent-red" : "text-fg-subtle"}
        valueColor={failedCount > 0 ? "text-accent-red" : undefined}
      />
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  iconColor,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  iconColor: string;
  valueColor?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-canvas-subtle p-5">
      <div className={`mb-3 ${iconColor}`}>{icon}</div>
      <p className="text-xs font-medium text-fg-muted uppercase tracking-wider mb-1.5">
        {label}
      </p>
      <p
        className={`text-4xl font-bold font-mono leading-none tabular-nums ${valueColor ?? "text-fg"}`}
      >
        {value}
      </p>
      <p className="mt-2 text-[11px] text-fg-subtle">{sub}</p>
    </div>
  );
}
