"use client";

import { useState } from "react";
import { Loader2, Share2, Zap, ChevronDown } from "lucide-react";
import { cn, polarityColor, engineColor } from "@/lib/utils";
import type { InsightsResponse, BrandSentiment, RunData } from "@/lib/types";
import { GeoGraphViz } from "./GeoGraphViz";

interface GraphInsightsSectionProps {
  insights: InsightsResponse | null;
  onRun: () => void;
  isRunning: boolean;
  sentiments: BrandSentiment[] | null;
  onRunSentiment: () => void;
  isRunningSentiment: boolean;
  runData?: RunData | null;
}

const INSIGHTS: {
  key: keyof InsightsResponse;
  label: string;
  description: string;
  accent: string;
}[] = [
  {
    key: "consideration_set",
    label: "Consideration Set",
    description: "Which brands the AI groups together — and whether you're in the cluster.",
    accent: "#58a6ff",
  },
  {
    key: "absence_explanation",
    label: "When You're Absent",
    description: "Who won the response when you weren't mentioned, and via which sources.",
    accent: "#f85149",
  },
  {
    key: "centrality_narrative",
    label: "Source Centrality",
    description: "Which cited sources appear most across competitor-recommending responses.",
    accent: "#e3b341",
  },
  {
    key: "sentiment_sources",
    label: "Sentiment & Sources",
    description: "Engines or sources associated with more critical coverage of your brand.",
    accent: "#bc8cff",
  },
  {
    key: "segment_gaps",
    label: "Segment Gaps",
    description: "Which buyer intents and personas show you mentioned least.",
    accent: "#3fb950",
  },
];

const POLARITY_LABEL: Record<string, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
  mixed: "Mixed",
};

function firstSentence(text: string): string {
  const m = text.match(/[^.!?]*[.!?]/);
  const s = m ? m[0].trim() : text.trim();
  return s.length > 120 ? s.slice(0, 118) + "…" : s;
}

export function GraphInsightsSection({
  insights,
  onRun,
  isRunning,
  sentiments,
  onRunSentiment,
  isRunningSentiment,
  runData,
}: GraphInsightsSectionProps) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  function toggleKey(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-border bg-canvas-subtle p-5 space-y-5">
      {/* ── Graph Insights zone ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-fg">Graph Insights</h3>
            <p className="text-[11px] text-fg-muted mt-1">
              Semantic narratives from the Cognee knowledge graph — consideration set,
              source centrality, absence analysis, and segment gaps.
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
              <Share2 className="w-3.5 h-3.5" />
            )}
            {isRunning ? "Building graph…" : "Run Graph Insights"}
          </button>
        </div>

        {!insights && !isRunning && (
          <p className="mt-4 text-xs text-fg-subtle">
            Click{" "}
            <span className="text-fg-muted font-medium">Run Graph Insights</span> to
            ingest this run into the knowledge graph and generate semantic narratives.
            Takes ~30–60s.
          </p>
        )}

        {isRunning && (
          <div className="mt-4 flex items-center gap-2 text-xs text-fg-muted">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-blue" />
            Ingesting into Cognee knowledge graph and running recall queries… (~30–60s)
          </div>
        )}

        {insights && (
          <div className="mt-4 rounded-lg border border-border bg-canvas overflow-hidden">
            {INSIGHTS.map(({ key, label, description, accent }, idx) => {
              const text = insights[key];
              const isEmpty =
                !text || text === "No graph data available for this query.";
              const isOpen = openKeys.has(key);
              const isLast = idx === INSIGHTS.length - 1;
              return (
                <div key={key} className={cn(!isLast && "border-b border-border")}>
                  {/* Row header — always visible, click to expand */}
                  <button
                    onClick={() => toggleKey(key)}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-canvas-subtle transition-colors text-left"
                    style={{ borderLeftWidth: 3, borderLeftColor: accent }}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-semibold text-fg mr-1.5">
                        {label}
                      </span>
                      <span
                        className={cn(
                          "text-[11px] leading-relaxed",
                          isEmpty ? "text-fg-subtle italic" : "text-fg-muted"
                        )}
                      >
                        {isEmpty ? "No data returned." : firstSentence(text)}
                      </span>
                    </div>
                    <ChevronDown
                      className={cn(
                        "w-3.5 h-3.5 text-fg-subtle shrink-0 mt-0.5 transition-transform duration-200",
                        isOpen && "rotate-180"
                      )}
                    />
                  </button>

                  {/* Expanded full text */}
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 border-t border-border bg-canvas-subtle">
                      <p className="text-[11px] text-fg-subtle mb-1">{description}</p>
                      <p
                        className={cn(
                          "text-xs leading-relaxed",
                          isEmpty ? "text-fg-subtle italic" : "text-fg-muted"
                        )}
                      >
                        {isEmpty ? "No data returned for this query." : text}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Divider ─────────────────────────────────────────────────────── */}
      <div className="border-t border-border" />

      {/* ── Deep Sentiment zone ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-fg">Deep Sentiment</h3>
            <p className="text-[11px] text-fg-muted mt-1">
              Per-brand, per-engine polarity and positioning trait, traced to citation domains.
            </p>
          </div>
          <button
            onClick={onRunSentiment}
            disabled={isRunningSentiment}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium shrink-0",
              "border border-border bg-btn-secondary hover:bg-btn-secondary-hover text-fg",
              "disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            )}
          >
            {isRunningSentiment ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            {isRunningSentiment ? "Analyzing…" : "Run Deep Sentiment"}
          </button>
        </div>

        {!sentiments && !isRunningSentiment && (
          <p className="mt-4 text-xs text-fg-subtle">
            Click{" "}
            <span className="text-fg-muted font-medium">Run Deep Sentiment</span> to
            extract polarity and positioning per brand.
          </p>
        )}

        {isRunningSentiment && (
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
                  {["Brand", "Engine", "Polarity", "Trait", "Key Sources"].map((h) => (
                    <th
                      key={h}
                      className="py-2.5 pr-4 text-left font-medium text-fg-muted uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
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
                      <td className="py-2.5 pr-4 whitespace-nowrap">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{
                            color: engineColor(s.engine),
                            backgroundColor: engineColor(s.engine) + "20",
                            border: `1px solid ${engineColor(s.engine)}40`,
                          }}
                        >
                          {s.engine}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ color: pColor, backgroundColor: `${pColor}20` }}
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

      {/* ── Response Graph ───────────────────────────────────────────────── */}
      {runData && (
        <>
          <div className="border-t border-border" />
          <GeoGraphViz runData={runData} />
        </>
      )}
    </div>
  );
}
