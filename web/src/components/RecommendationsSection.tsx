"use client";

import { useState } from "react";
import { Loader2, Lightbulb, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { cn, priorityColor } from "@/lib/utils";
import type { RecommendationsResponse } from "@/lib/types";

interface RecommendationsSectionProps {
  data: RecommendationsResponse | null;
  onRun: () => void;
  isRunning: boolean;
}

const PRIORITY_LABEL: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function RecommendationsSection({
  data,
  onRun,
  isRunning,
}: RecommendationsSectionProps) {
  const [artifactOpen, setArtifactOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-canvas-subtle p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-fg">
            Recommendations
          </h3>
          <p className="text-[11px] text-fg-muted mt-1">
            Grounded in this run's citation gaps, sentiment findings, and segment
            data.
          </p>
        </div>
        <button
          onClick={onRun}
          disabled={isRunning}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold shrink-0",
            "bg-btn-primary hover:bg-btn-primary-hover text-white",
            "disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          )}
        >
          {isRunning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Lightbulb className="w-3.5 h-3.5" />
          )}
          {isRunning ? "Generating…" : "Generate Recommendations"}
        </button>
      </div>

      {!data && !isRunning && (
        <p className="mt-4 text-xs text-fg-subtle">
          Click{" "}
          <span className="text-fg-muted font-medium">
            Generate Recommendations
          </span>{" "}
          for data-grounded action items. Run Sentiment first for richer results.
        </p>
      )}

      {isRunning && (
        <div className="mt-4 flex items-center gap-2 text-xs text-fg-muted">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-blue" />
          Generating grounded recommendations… (~10s)
        </div>
      )}

      {data && data.recommendations.length > 0 && (
        <div className="mt-5 space-y-3">
          {data.recommendations.map((rec, i) => {
            const color = priorityColor(rec.priority);
            return (
              <div
                key={i}
                className="rounded-lg border border-border bg-canvas p-4"
                style={{ borderLeftWidth: 3, borderLeftColor: color }}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm font-semibold text-fg leading-snug">
                    {rec.title}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
                      style={{
                        color,
                        backgroundColor: `${color}20`,
                      }}
                    >
                      {PRIORITY_LABEL[rec.priority] ?? rec.priority}
                    </span>
                    {rec.target_source && (
                      <span className="flex items-center gap-0.5 text-[10px] text-fg-subtle font-mono">
                        <ExternalLink className="w-2.5 h-2.5" />
                        {rec.target_source}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-fg-muted leading-relaxed">
                  <span className="font-medium text-fg">Why: </span>
                  {rec.rationale}
                </p>
                <p className="mt-1.5 text-xs text-fg-muted leading-relaxed">
                  <span className="font-medium text-fg">Action: </span>
                  {rec.action}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {data?.artifact && (
        <div className="mt-4 rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setArtifactOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 bg-canvas hover:bg-canvas-subtle transition-colors text-xs"
          >
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-accent-purple/20 text-accent-purple text-[10px] font-medium uppercase tracking-wide">
                {data.artifact.artifact_type.replace("_", " ")}
              </span>
              <span className="font-medium text-fg">
                {data.artifact.title}
              </span>
            </div>
            {artifactOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-fg-muted" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-fg-muted" />
            )}
          </button>
          {artifactOpen && (
            <div className="px-4 pb-4 border-t border-border">
              <pre className="mt-3 text-xs text-fg-muted leading-relaxed whitespace-pre-wrap font-sans">
                {data.artifact.content}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
