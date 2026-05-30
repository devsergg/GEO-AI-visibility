"use client";

import { useState } from "react";
import {
  Search,
  Play,
  ChevronDown,
  ChevronRight,
  Loader2,
  Radio,
} from "lucide-react";
import { cn, engineLabel, ALL_ENGINES, formatRunId } from "@/lib/utils";
import type { CachedRunMeta } from "@/lib/types";

interface SidebarProps {
  brand: string;
  onBrandChange: (v: string) => void;
  competitors: string;
  onCompetitorsChange: (v: string) => void;
  market: string;
  onMarketChange: (v: string) => void;
  engines: string[];
  onEnginesChange: (v: string[]) => void;
  useVariation: boolean;
  onUseVariationChange: (v: boolean) => void;
  maxPrompts: number;
  onMaxPromptsChange: (v: number) => void;
  isRunning: boolean;
  onRun: () => void;
  onResearch: () => void;
  isResearching: boolean;
  cachedRuns: CachedRunMeta[];
  onLoadRun: (runId: string) => void;
  isLoadingRun: boolean;
  error: string | null;
}

export function Sidebar({
  brand,
  onBrandChange,
  competitors,
  onCompetitorsChange,
  market,
  onMarketChange,
  engines,
  onEnginesChange,
  useVariation,
  onUseVariationChange,
  maxPrompts,
  onMaxPromptsChange,
  isRunning,
  onRun,
  onResearch,
  isResearching,
  cachedRuns,
  onLoadRun,
  isLoadingRun,
  error,
}: SidebarProps) {
  const [cacheOpen, setCacheOpen] = useState(false);
  const [selectedCacheId, setSelectedCacheId] = useState<string>("");
  const isBusy = isRunning || isResearching || isLoadingRun;

  const toggleEngine = (eng: string) => {
    if (engines.includes(eng)) {
      onEnginesChange(engines.filter((e) => e !== eng));
    } else {
      onEnginesChange([...engines, eng]);
    }
  };

  const estRequests = maxPrompts * engines.length;

  return (
    <aside className="flex flex-col w-68 h-screen bg-canvas-subtle border-r border-border shrink-0 overflow-y-auto">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-accent-blue/20 border border-accent-blue/40 flex items-center justify-center">
            <Radio className="w-3.5 h-3.5 text-accent-blue" />
          </div>
          <div>
            <p className="text-sm font-semibold text-fg leading-none">
              GEO Command Center
            </p>
            <p className="text-[10px] text-fg-muted mt-0.5">AI Visibility Intelligence</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 space-y-5">
        {/* Target brand */}
        <div>
          <label className="block text-xs font-medium text-fg-muted uppercase tracking-wider mb-1.5">
            Target Brand
          </label>
          <input
            type="text"
            value={brand}
            onChange={(e) => onBrandChange(e.target.value)}
            placeholder="e.g. HubSpot"
            disabled={isBusy}
            className={inputCls}
          />
        </div>

        {/* Research button */}
        <button
          onClick={onResearch}
          disabled={isBusy || !brand.trim()}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium",
            "border border-border bg-btn-secondary hover:bg-btn-secondary-hover",
            "text-fg transition-colors",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {isResearching ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Search className="w-3.5 h-3.5" />
          )}
          {isResearching ? "Researching…" : "Research Company"}
        </button>

        {/* Competitors */}
        <div>
          <label className="block text-xs font-medium text-fg-muted uppercase tracking-wider mb-1.5">
            Competitors <span className="normal-case">(one per line)</span>
          </label>
          <textarea
            value={competitors}
            onChange={(e) => onCompetitorsChange(e.target.value)}
            rows={4}
            disabled={isBusy}
            className={cn(inputCls, "resize-none")}
            placeholder={"Salesforce\nPipedrive\nActiveCampaign"}
          />
        </div>

        {/* Market */}
        <div>
          <label className="block text-xs font-medium text-fg-muted uppercase tracking-wider mb-1.5">
            Market / Category
          </label>
          <input
            type="text"
            value={market}
            onChange={(e) => onMarketChange(e.target.value)}
            disabled={isBusy}
            className={inputCls}
            placeholder="CRM software for small businesses"
          />
        </div>

        {/* Engines */}
        <div>
          <label className="block text-xs font-medium text-fg-muted uppercase tracking-wider mb-2">
            AI Engines
          </label>
          <div className="space-y-1.5">
            {ALL_ENGINES.map((eng) => (
              <label
                key={eng}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md cursor-pointer",
                  "hover:bg-canvas transition-colors text-xs",
                  engines.includes(eng)
                    ? "text-fg"
                    : "text-fg-muted"
                )}
              >
                <input
                  type="checkbox"
                  checked={engines.includes(eng)}
                  onChange={() => toggleEngine(eng)}
                  disabled={isBusy}
                  className="rounded border-border bg-canvas accent-accent-blue w-3.5 h-3.5"
                />
                {engineLabel(eng)}
              </label>
            ))}
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Variation toggle */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-fg">Variation Engine</p>
            <p className="text-[11px] text-fg-muted mt-0.5">
              Market-specific prompts via gpt-4o-mini
            </p>
          </div>
          <button
            role="switch"
            aria-checked={useVariation}
            onClick={() => onUseVariationChange(!useVariation)}
            disabled={isBusy}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors",
              "border border-border",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              useVariation ? "bg-accent-green/70" : "bg-canvas"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 rounded-full bg-fg shadow transition-transform mt-0.5",
                useVariation ? "translate-x-4" : "translate-x-0.5"
              )}
            />
          </button>
        </div>

        {/* Max prompts slider */}
        {useVariation && (
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-medium text-fg-muted uppercase tracking-wider">
                Max Prompts
              </label>
              <span className="text-xs font-mono text-accent-blue">{maxPrompts}</span>
            </div>
            <input
              type="range"
              min={5}
              max={20}
              value={maxPrompts}
              onChange={(e) => onMaxPromptsChange(Number(e.target.value))}
              disabled={isBusy}
              className="w-full accent-accent-blue"
            />
            <p className="text-[11px] text-fg-subtle mt-1">
              ~{estRequests} Bright Data request{estRequests !== 1 ? "s" : ""}
            </p>
          </div>
        )}

        {/* Run button */}
        <button
          onClick={onRun}
          disabled={isBusy || !brand.trim() || engines.length === 0}
          className={cn(
            "w-full flex items-center justify-center gap-2",
            "px-4 py-2.5 rounded-md text-sm font-semibold",
            "bg-btn-primary hover:bg-btn-primary-hover text-white",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "transition-colors shadow-sm"
          )}
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running…
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Live Analysis
            </>
          )}
        </button>

        {isRunning && (
          <p className="text-[11px] text-fg-muted text-center leading-relaxed">
            Querying {engines.length} engine{engines.length !== 1 ? "s" : ""} across up to{" "}
            {maxPrompts} prompts. This takes 1–3 minutes.
          </p>
        )}

        {error && (
          <div className="rounded-md bg-accent-red/10 border border-accent-red/30 px-3 py-2">
            <p className="text-xs text-accent-red leading-relaxed">{error}</p>
          </div>
        )}
      </div>

      {/* Cached runs */}
      <div className="border-t border-border">
        <button
          onClick={() => setCacheOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-fg-muted hover:text-fg transition-colors"
        >
          <span>Cached Runs ({cachedRuns.length})</span>
          {cacheOpen ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>
        {cacheOpen && (
          <div className="px-4 pb-4 space-y-2">
            {cachedRuns.length === 0 ? (
              <p className="text-xs text-fg-subtle">No cached runs yet.</p>
            ) : (
              <>
                <select
                  value={selectedCacheId}
                  onChange={(e) => setSelectedCacheId(e.target.value)}
                  className={cn(inputCls, "text-[11px]")}
                >
                  <option value="">Select a run…</option>
                  {cachedRuns.map((r) => (
                    <option key={r.run_id} value={r.run_id}>
                      {r.target_brand} — {formatRunId(r.run_id)} ({r.result_count} results)
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (selectedCacheId) onLoadRun(selectedCacheId);
                  }}
                  disabled={!selectedCacheId || isBusy}
                  className={cn(
                    "w-full px-3 py-1.5 rounded-md text-xs font-medium",
                    "border border-border bg-btn-secondary hover:bg-btn-secondary-hover",
                    "text-fg transition-colors",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                    "flex items-center justify-center gap-1.5"
                  )}
                >
                  {isLoadingRun ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : null}
                  Load Run
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-md text-xs bg-canvas border border-border text-fg " +
  "placeholder:text-fg-subtle focus:outline-none focus:ring-1 focus:ring-accent-blue " +
  "disabled:opacity-50 disabled:cursor-not-allowed";
