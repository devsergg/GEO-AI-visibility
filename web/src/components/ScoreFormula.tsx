"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FlaskConical } from "lucide-react";
import type { ScoreResult } from "@/lib/types";

interface ScoreFormulaProps {
  score: ScoreResult;
}

export function ScoreFormula({ score }: ScoreFormulaProps) {
  const [open, setOpen] = useState(false);
  const comp = score.components;

  return (
    <div className="rounded-xl border border-border bg-canvas-subtle overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-canvas transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <FlaskConical className="w-4 h-4 text-fg-muted" />
          <span className="text-sm font-medium text-fg">
            Score Formula &amp; Components
          </span>
        </div>
        {open ? (
          <ChevronDown className="w-4 h-4 text-fg-muted" />
        ) : (
          <ChevronRight className="w-4 h-4 text-fg-muted" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-border">
          <div className="mt-4 rounded-md bg-canvas border border-border px-4 py-3 font-mono text-xs text-accent-blue">
            visibility_score = (mention_rate × 0.7 + position_score × 0.3) × 100
          </div>

          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 text-xs font-medium text-fg-muted uppercase tracking-wider">
                  Component
                </th>
                <th className="text-right py-2 text-xs font-medium text-fg-muted uppercase tracking-wider">
                  Value
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <FormulaRow
                label="Responses with target mentioned"
                value={`${comp.mention_count} / ${comp.total_responses}`}
              />
              <FormulaRow
                label="Mention rate"
                value={`${(comp.mention_rate * 100).toFixed(1)}%`}
                accent
              />
              <FormulaRow
                label="Avg position when mentioned"
                value={comp.avg_position != null ? `#${comp.avg_position}` : "N/A"}
              />
              <FormulaRow
                label="Position score (0–1)"
                value={comp.position_score.toFixed(3)}
              />
              <FormulaRow
                label="Weight: mention rate"
                value={`${comp.weight_mention}`}
              />
              <FormulaRow
                label="Weight: position score"
                value={`${comp.weight_position}`}
              />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FormulaRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <tr>
      <td className="py-2 pr-4 text-sm text-fg-muted">{label}</td>
      <td
        className={`py-2 text-right font-mono text-sm ${
          accent ? "text-accent-blue font-semibold" : "text-fg"
        }`}
      >
        {value}
      </td>
    </tr>
  );
}
