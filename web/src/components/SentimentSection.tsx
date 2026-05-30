"use client";

import { Loader2, Zap } from "lucide-react";
import { cn, polarityColor } from "@/lib/utils";
import type { BrandSentiment } from "@/lib/types";

interface SentimentSectionProps {
  sentiments: BrandSentiment[] | null;
  onRun: () => void;
  isRunning: boolean;
}

const POLARITY_LABEL: Record<string, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
  mixed: "Mixed",
};

export function SentimentSection({
  sentiments,
  onRun,
  isRunning,
}: SentimentSectionProps) {
  return (
    <div className="rounded-xl border border-border bg-canvas-subtle p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-fg">
            Sentiment Breakdown
          </h3>
          <p className="text-[11px] text-fg-muted mt-1">
            Per-brand, per-engine polarity and positioning trait, traced to citation
            domains.
          </p>
        </div>
        <button
          onClick={onRun}
          disabled={isRunning}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium shrink-0",
            "border border-border bg-btn-secondary hover:bg-btn-secondary-hover text-fg",
            "disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          )}
        >
          {isRunning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Zap className="w-3.5 h-3.5" />
          )}
          {isRunning ? "Analyzing…" : "Run Sentiment"}
        </button>
      </div>

      {!sentiments && !isRunning && (
        <p className="mt-4 text-xs text-fg-subtle">
          Click <span className="text-fg-muted font-medium">Run Sentiment</span> to
          extract polarity and positioning per brand.
        </p>
      )}

      {isRunning && (
        <div className="mt-4 flex items-center gap-2 text-xs text-fg-muted">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-blue" />
          Extracting sentiment per brand per engine… (~10s)
        </div>
      )}

      {sentiments && sentiments.length > 0 && (
        <div className="mt-4 overflow-x-auto -mx-5 px-5">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                {["Brand", "Engine", "Polarity", "Trait", "Key Sources"].map(
                  (h) => (
                    <th
                      key={h}
                      className="py-2.5 pr-4 text-left font-medium text-fg-muted uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sentiments.map((s, i) => {
                const pColor = polarityColor(s.polarity);
                return (
                  <tr key={i} className="hover:bg-canvas-inset/40">
                    <td className="py-2.5 pr-4 font-medium text-fg whitespace-nowrap">
                      {s.brand}
                    </td>
                    <td className="py-2.5 pr-4 text-fg-muted whitespace-nowrap">
                      {s.engine}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          color: pColor,
                          backgroundColor: `${pColor}20`,
                        }}
                      >
                        {POLARITY_LABEL[s.polarity] ?? s.polarity}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-fg-muted italic">
                      {s.trait || "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-fg-subtle">
                      {s.source_domains.slice(0, 3).join(", ") || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {sentiments && sentiments.length === 0 && (
        <p className="mt-4 text-xs text-fg-muted">
          No sentiment data extracted. Ensure OpenAI key is configured.
        </p>
      )}
    </div>
  );
}
