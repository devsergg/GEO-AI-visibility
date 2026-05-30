"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Dot,
} from "recharts";
import { Loader2, TrendingUp } from "lucide-react";
import { scoreColor, formatRunId } from "@/lib/utils";
import type { CachedRunMeta } from "@/lib/types";
import * as api from "@/lib/api";

interface RunPoint {
  run_id: string;
  target_brand: string;
  label: string;
  score: number;
}

interface OvertimeViewProps {
  cachedRuns: CachedRunMeta[];
  currentRunId: string | null;
  onLoadRun: (runId: string) => void;
}

export function OvertimeView({
  cachedRuns,
  currentRunId,
  onLoadRun,
}: OvertimeViewProps) {
  const [points, setPoints] = useState<RunPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Determine which brand to scope the graph to:
  // prefer the currently loaded run's brand, fall back to the most recent cached run.
  const activeBrand =
    (currentRunId
      ? cachedRuns.find((r) => r.run_id === currentRunId)?.target_brand
      : undefined) ?? cachedRuns[0]?.target_brand ?? null;

  const brandRuns = activeBrand
    ? cachedRuns.filter((r) => r.target_brand === activeBrand)
    : cachedRuns;

  useEffect(() => {
    if (brandRuns.length === 0) {
      setPoints([]);
      return;
    }
    setIsLoading(true);
    Promise.all(
      brandRuns.map(async (r) => {
        try {
          const data = await api.loadRun(r.run_id);
          return {
            run_id: r.run_id,
            target_brand: r.target_brand,
            label: formatRunId(r.run_id),
            score: data.score.visibility_score,
          } as RunPoint;
        } catch {
          return null;
        }
      })
    ).then((results) => {
      const valid = results
        .filter((r): r is RunPoint => r !== null)
        .sort((a, b) => a.run_id.localeCompare(b.run_id));
      setPoints(valid);
      setIsLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBrand, cachedRuns]);

  if (cachedRuns.length === 0) {
    return (
      <EmptyOvertime
        icon={<TrendingUp className="w-7 h-7 text-fg-muted" />}
        title="No runs yet"
        body="Run an analysis to start building your visibility history."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="w-8 h-8 text-accent-blue animate-spin" />
        <p className="text-sm text-fg-muted">
          Loading scores for {cachedRuns.length} run
          {cachedRuns.length !== 1 ? "s" : ""}…
        </p>
      </div>
    );
  }

  const avg =
    points.length > 0
      ? Math.round(points.reduce((s, p) => s + p.score, 0) / points.length)
      : 0;

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Runs" value={String(points.length)} />
        <StatCard label="Avg Visibility" value={`${avg}/100`} color={scoreColor(avg)} />
        <StatCard
          label="Latest Score"
          value={points.length > 0 ? `${points[points.length - 1].score}/100` : "—"}
          color={
            points.length > 0 ? scoreColor(points[points.length - 1].score) : undefined
          }
        />
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-border bg-canvas-subtle p-5">
        <h3 className="text-sm font-semibold text-fg mb-1">
          Visibility Score History
        </h3>
        <p className="text-[11px] text-fg-muted mb-5">
          Showing history for{" "}
          <span className="font-semibold text-fg">{activeBrand}</span>.
          Click a point to load that run.
        </p>

        {points.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <TrendingUp className="w-8 h-8 text-fg-subtle" />
            <p className="text-sm text-fg-muted">
              Run more analyses to see a trend line.
            </p>
            <p className="text-xs text-fg-subtle">
              You have {points.length === 1 ? "1 run" : "no runs"} — need at
              least 2 to draw a trend.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={points}
              margin={{ top: 8, right: 24, bottom: 48, left: 0 }}
              onClick={(d) => {
                if (d?.activePayload?.[0]) {
                  const pt = d.activePayload[0].payload as RunPoint;
                  onLoadRun(pt.run_id);
                }
              }}
              style={{ cursor: "pointer" }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#21262d"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: "#8b949e", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "#8b949e", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <ReferenceLine
                y={avg}
                stroke="#8b949e"
                strokeDasharray="4 3"
                strokeWidth={1}
                label={{
                  value: `avg ${avg}`,
                  position: "right",
                  fill: "#8b949e",
                  fontSize: 10,
                }}
              />
              <Tooltip
                cursor={{ stroke: "#8b949e", strokeWidth: 1, strokeDasharray: "4 3" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const pt = payload[0].payload as RunPoint;
                  return (
                    <div className="rounded-md border border-border bg-canvas-subtle px-3 py-2 text-xs shadow-lg">
                      <p className="font-semibold text-fg">{pt.target_brand}</p>
                      <p className="text-fg-muted font-mono">{pt.label}</p>
                      <p className="mt-1">
                        Score:{" "}
                        <span
                          className="font-bold font-mono"
                          style={{ color: scoreColor(pt.score) }}
                        >
                          {pt.score}
                        </span>
                        /100
                      </p>
                      <p className="mt-1 text-[10px] text-fg-subtle">
                        Click to load this run
                      </p>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#58a6ff"
                strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload } = props as {
                    cx: number;
                    cy: number;
                    payload: RunPoint;
                  };
                  const isCurrent = payload.run_id === currentRunId;
                  const color = scoreColor(payload.score);
                  return (
                    <Dot
                      key={payload.run_id}
                      cx={cx}
                      cy={cy}
                      r={isCurrent ? 6 : 4}
                      fill={color}
                      stroke={isCurrent ? "#58a6ff" : "#0d1117"}
                      strokeWidth={isCurrent ? 2 : 1.5}
                    />
                  );
                }}
                activeDot={{ r: 7, fill: "#58a6ff", stroke: "#0d1117", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Run list */}
      <div className="rounded-xl border border-border bg-canvas-subtle overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-baseline gap-2">
          <h3 className="text-sm font-semibold text-fg">Run History</h3>
          {activeBrand && (
            <span className="text-[11px] text-fg-subtle">— {activeBrand}</span>
          )}
        </div>
        <div className="divide-y divide-border">
          {points
            .slice()
            .reverse()
            .map((pt) => (
              <button
                key={pt.run_id}
                onClick={() => onLoadRun(pt.run_id)}
                className="w-full flex items-center gap-4 px-5 py-3 hover:bg-canvas-inset/30 transition-colors text-left"
              >
                <div
                  className="w-10 text-center text-sm font-bold font-mono leading-none tabular-nums shrink-0"
                  style={{ color: scoreColor(pt.score) }}
                >
                  {pt.score}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-fg">{pt.target_brand}</p>
                  <p className="text-[10px] text-fg-subtle font-mono">{pt.label}</p>
                </div>
                {pt.run_id === currentRunId && (
                  <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border border-accent-blue/30 text-accent-blue bg-accent-blue/10 font-medium">
                    loaded
                  </span>
                )}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-canvas-subtle p-4">
      <p className="text-[10px] font-semibold text-fg-muted uppercase tracking-widest mb-1">
        {label}
      </p>
      <p
        className="text-xl font-bold font-mono tabular-nums"
        style={{ color: color ?? "#e6edf3" }}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyOvertime({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl border border-border bg-canvas-subtle flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-base font-semibold text-fg">{title}</p>
        <p className="text-sm text-fg-muted mt-1 max-w-xs">{body}</p>
      </div>
    </div>
  );
}
