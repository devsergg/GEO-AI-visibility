"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { engineLabel, engineColor, scoreColor } from "@/lib/utils";
import type { ScoreResult } from "@/lib/types";

interface EngineChartProps {
  score: ScoreResult;
}

export function EngineChart({ score }: EngineChartProps) {
  const data = Object.entries(score.by_engine)
    .map(([eng, val]) => ({ engine: engineLabel(eng), score: val, raw: eng }))
    .sort((a, b) => b.score - a.score);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-canvas-subtle p-5">
        <SectionTitle>Visibility by Engine</SectionTitle>
        <p className="text-xs text-fg-muted mt-4">No engine data.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-canvas-subtle p-5">
      <SectionTitle>Visibility by Engine</SectionTitle>
      <p className="text-[11px] text-fg-muted mt-1 mb-4">
        Share-of-voice score per AI engine (0–100)
      </p>

      <ResponsiveContainer width="100%" height={Math.max(data.length * 44, 120)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 48, bottom: 0, left: 0 }}
        >
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fill: "#8b949e", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="engine"
            width={130}
            tick={{ fill: "#8b949e", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { engine: string; score: number; raw: string };
              return (
                <div className="rounded-md border border-border bg-canvas-subtle px-3 py-2 text-xs shadow-lg">
                  <p className="font-medium" style={{ color: engineColor(d.raw) }}>{d.engine}</p>
                  <p className="text-fg-muted mt-0.5">
                    Score:{" "}
                    <span
                      className="font-mono font-semibold"
                      style={{ color: scoreColor(d.score) }}
                    >
                      {d.score}
                    </span>
                    /100
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={28}>
            {data.map((entry) => (
              <Cell
                key={entry.raw}
                fill={engineColor(entry.raw)}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-fg">{children}</h3>
  );
}
