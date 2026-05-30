"use client";

import { scoreColor, scoreLabel } from "@/lib/utils";
import type { ScoreResult } from "@/lib/types";

interface MetricsRowProps {
  score: ScoreResult;
  respondedCount: number;
  failedCount: number;
}

// ── Shared constants ─────────────────────────────────────────────────────────
const RADIUS = 38;
const STROKE = 9;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// For a 270° arc gauge — the remaining 90° gap sits at the bottom
const GAUGE_ARC = CIRCUMFERENCE * 0.75;

// ── Main export ──────────────────────────────────────────────────────────────
export function MetricsRow({ score, respondedCount, failedCount }: MetricsRowProps) {
  const visColor = scoreColor(score.visibility_score);
  const visLabel = scoreLabel(score.visibility_score);
  const total = respondedCount + failedCount;
  const successRate = total > 0 ? (respondedCount / total) * 100 : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* ── Visibility Score ─────────────────────────────────────────── */}
      <div className="col-span-2 lg:col-span-1 rounded-2xl border border-border bg-canvas-subtle p-4 flex items-center gap-4 relative overflow-hidden">
        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-10 blur-2xl"
          style={{ background: visColor }}
        />
        <GaugeRing score={score.visibility_score} color={visColor} />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-fg-muted uppercase tracking-widest mb-1">
            Visibility Score
          </p>
          <p className="text-xl font-bold text-fg leading-none">
            {score.visibility_score}
            <span className="text-sm font-normal text-fg-muted">/100</span>
          </p>
          <p className="mt-1.5 text-xs font-semibold" style={{ color: visColor }}>
            {visLabel}
          </p>
          <p className="mt-1 text-[10px] text-fg-subtle leading-snug">
            {score.components.mention_count}/{score.components.total_responses} responses mentioned brand
          </p>
        </div>
      </div>

      {/* ── Mention Rate ─────────────────────────────────────────────── */}
      <MetricPanel label="Mention Rate" accent="#58a6ff">
        <div className="flex items-end gap-1 mb-3">
          <span className="text-5xl font-bold font-mono leading-none tabular-nums text-fg">
            {(score.mention_rate * 100).toFixed(0)}
          </span>
          <span className="text-xl text-fg-muted mb-1">%</span>
        </div>
        <ProgressBar value={score.mention_rate * 100} color="#58a6ff" />
        <p className="mt-2 text-[11px] text-fg-subtle">
          {score.components.mention_count} of {score.components.total_responses} engine responses
        </p>
      </MetricPanel>

      {/* ── Avg Position ─────────────────────────────────────────────── */}
      <MetricPanel label="Avg Position" accent="#e3b341">
        {score.avg_position != null ? (
          <>
            <div className="flex items-end gap-1 mb-3">
              <span className="text-xl font-bold text-fg-muted leading-none">#</span>
              <span className="text-5xl font-bold font-mono leading-none tabular-nums text-fg">
                {score.avg_position.toFixed(1)}
              </span>
            </div>
            <PositionDots position={score.avg_position} />
            <p className="mt-2 text-[11px] text-fg-subtle">
              When mentioned · position score {(score.components.position_score * 100).toFixed(0)}%
            </p>
          </>
        ) : (
          <>
            <div className="flex items-end gap-1 mb-3">
              <span className="text-5xl font-bold font-mono leading-none text-fg-subtle">—</span>
            </div>
            <p className="text-[11px] text-fg-subtle">
              Brand not mentioned in any response
            </p>
          </>
        )}
      </MetricPanel>

      {/* ── Responses ────────────────────────────────────────────────── */}
      <MetricPanel
        label="Engine Responses"
        accent={failedCount > 0 ? "#f85149" : "#3fb950"}
      >
        <div className="flex items-end gap-1.5 mb-3">
          <span className="text-5xl font-bold font-mono leading-none tabular-nums text-fg">
            {respondedCount}
          </span>
          <span className="text-xl text-fg-muted mb-1">/ {total}</span>
        </div>
        <ProgressBar
          value={successRate}
          color={failedCount > 0 ? "#f85149" : "#3fb950"}
        />
        <p className="mt-2 text-[11px] text-fg-subtle">
          {failedCount === 0
            ? "All engines responded successfully"
            : `${failedCount} failed — see raw responses`}
        </p>
      </MetricPanel>
    </div>
  );
}

// ── GaugeRing ────────────────────────────────────────────────────────────────
function GaugeRing({ score, color }: { score: number; color: string }) {
  // 270° arc gauge: track shows 75% of circumference, gap sits at bottom.
  // The filled arc is (score/100) × GAUGE_ARC.
  // We rotate -135° so the gap aligns to the bottom centre.
  const filled = (score / 100) * GAUGE_ARC;

  return (
    <div className="relative shrink-0 w-[72px] h-[72px]">
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        style={{ transform: "rotate(-225deg)" }}
      >
        {/* Track — 270° arc */}
        <circle
          cx="50" cy="50" r={RADIUS}
          fill="none"
          stroke="#21262d"
          strokeWidth={STROKE}
          strokeDasharray={`${GAUGE_ARC} ${CIRCUMFERENCE}`}
          strokeLinecap="round"
        />
        {/* Score fill */}
        <circle
          cx="50" cy="50" r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 5px ${color}80)`,
            transition: "stroke-dasharray 0.6s ease",
          }}
        />
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-2xl font-bold font-mono leading-none tabular-nums"
          style={{ color }}
        >
          {score}
        </span>
      </div>
    </div>
  );
}

// ── ProgressBar ──────────────────────────────────────────────────────────────
function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full h-2 rounded-full bg-border overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          backgroundColor: color,
          boxShadow: `0 0 6px ${color}60`,
          transition: "width 0.5s ease",
        }}
      />
    </div>
  );
}

// ── PositionDots — shows relative position quality ───────────────────────────
function PositionDots({ position }: { position: number }) {
  const maxPos = 5;
  // Lower position = better. Convert to a "quality" fill: position 1 = full, 5+ = almost empty
  const quality = Math.max(0, 1 - (position - 1) / (maxPos - 1));
  const filledDots = Math.round(quality * 5);

  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className="h-1.5 flex-1 rounded-full"
          style={{
            backgroundColor: i < filledDots ? "#e3b341" : "#21262d",
          }}
        />
      ))}
    </div>
  );
}

// ── MetricPanel wrapper ──────────────────────────────────────────────────────
function MetricPanel({
  label,
  accent,
  children,
}: {
  label: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-canvas-subtle p-5 relative overflow-hidden">
      {/* Subtle top accent line */}
      <div
        className="absolute top-0 left-5 right-5 h-px opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />
      <p className="text-[11px] font-semibold text-fg-muted uppercase tracking-widest mb-3">
        {label}
      </p>
      {children}
    </div>
  );
}
