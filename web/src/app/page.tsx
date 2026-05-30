"use client";

import { useState, useEffect } from "react";
import { Loader2, Activity, Radio, AlertCircle, CheckCircle2 } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { MetricsRow } from "@/components/MetricsRow";
import { ScoreFormula } from "@/components/ScoreFormula";
import { EngineChart } from "@/components/EngineChart";
import { MentionTable } from "@/components/MentionTable";
import { CitationGap } from "@/components/CitationGap";
import { SentimentSection } from "@/components/SentimentSection";
import { RecommendationsSection } from "@/components/RecommendationsSection";
import * as api from "@/lib/api";
import { scoreColor, formatRunId } from "@/lib/utils";
import type {
  RunData,
  BrandSentiment,
  RecommendationsResponse,
  CachedRunMeta,
} from "@/lib/types";

export default function Home() {
  // ── Form state ─────────────────────────────────────────────────────────────
  const [brand, setBrand] = useState("HubSpot");
  const [competitors, setCompetitors] = useState(
    "Salesforce\nPipedrive\nActiveCampaign\nZoho CRM"
  );
  const [market, setMarket] = useState("CRM software for small businesses");
  const [engines, setEngines] = useState([
    "chatgpt",
    "google_serp",
    "perplexity",
    "gemini",
  ]);
  const [useVariation, setUseVariation] = useState(true);
  const [maxPrompts, setMaxPrompts] = useState(10);

  // ── Results state ───────────────────────────────────────────────────────────
  const [runData, setRunData] = useState<RunData | null>(null);
  const [sentiment, setSentiment] = useState<BrandSentiment[] | null>(null);
  const [recommendations, setRecommendations] =
    useState<RecommendationsResponse | null>(null);
  const [cachedRuns, setCachedRuns] = useState<CachedRunMeta[]>([]);

  // ── Loading flags ───────────────────────────────────────────────────────────
  const [isRunning, setIsRunning] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [isLoadingRun, setIsLoadingRun] = useState(false);
  const [isRunningSentiment, setIsRunningSentiment] = useState(false);
  const [isRunningRecs, setIsRunningRecs] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<"checking" | "ok" | "error">("checking");

  // ── Backend health check + cached run list on mount ─────────────────────────
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    fetch(`${base}/api/health`, { signal: AbortSignal.timeout(4000) })
      .then((r) => {
        if (r.ok) {
          setBackendStatus("ok");
          // Only load cached runs once we know the server is up
          api.listRuns().then(setCachedRuns).catch(() => {});
        } else {
          setBackendStatus("error");
        }
      })
      .catch(() => setBackendStatus("error"));
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────
  async function handleRun() {
    setError(null);
    setIsRunning(true);
    setSentiment(null);
    setRecommendations(null);
    try {
      const competitorList = competitors
        .split("\n")
        .map((c) => c.trim())
        .filter(Boolean);
      const data = await api.runAnalysis({
        brand: brand.trim(),
        competitors: competitorList,
        market: market.trim(),
        engines,
        use_variation: useVariation,
        max_prompts: maxPrompts,
      });
      setRunData(data);
      api.listRuns().then(setCachedRuns).catch(console.error);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRunning(false);
    }
  }

  async function handleResearch() {
    if (!brand.trim()) return;
    setIsResearching(true);
    setError(null);
    try {
      const result = await api.researchCompany(brand.trim());
      if (result.market) setMarket(result.market);
      if (result.competitors?.length) {
        setCompetitors(result.competitors.join("\n"));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsResearching(false);
    }
  }

  async function handleLoadRun(runId: string) {
    setIsLoadingRun(true);
    setError(null);
    setSentiment(null);
    setRecommendations(null);
    try {
      const data = await api.loadRun(runId);
      setRunData(data);
      setBrand(data.config.target_brand);
      setCompetitors(data.config.competitors.join("\n"));
      setMarket(data.config.market);
      setEngines(data.config.engines);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoadingRun(false);
    }
  }

  async function handleSentiment() {
    if (!runData) return;
    setIsRunningSentiment(true);
    setError(null);
    try {
      const result = await api.runSentiment(runData.run_id);
      setSentiment(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRunningSentiment(false);
    }
  }

  async function handleRecommendations() {
    if (!runData) return;
    setIsRunningRecs(true);
    setError(null);
    try {
      const result = await api.runRecommendations(
        runData.run_id,
        sentiment ?? undefined
      );
      setRecommendations(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRunningRecs(false);
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const responded = runData?.results.filter((r) => r.responded) ?? [];
  const failed = runData?.results.filter((r) => !r.responded) ?? [];

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {/* Sidebar wrapper — explicit width since w-68 is non-standard */}
      <div className="w-72 shrink-0">
        <Sidebar
          brand={brand}
          onBrandChange={setBrand}
          competitors={competitors}
          onCompetitorsChange={setCompetitors}
          market={market}
          onMarketChange={setMarket}
          engines={engines}
          onEnginesChange={setEngines}
          useVariation={useVariation}
          onUseVariationChange={setUseVariation}
          maxPrompts={maxPrompts}
          onMaxPromptsChange={setMaxPrompts}
          isRunning={isRunning}
          onRun={handleRun}
          onResearch={handleResearch}
          isResearching={isResearching}
          cachedRuns={cachedRuns}
          onLoadRun={handleLoadRun}
          isLoadingRun={isLoadingRun}
          error={error}
        />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {/* Sticky header bar */}
        <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-3 border-b border-border bg-canvas/80 backdrop-blur-sm shrink-0">
          <Radio className="w-4 h-4 text-accent-blue" />
          <h1 className="text-sm font-semibold text-fg">
            {runData ? runData.config.target_brand : "GEO Command Center"}
          </h1>
          {runData && (
            <>
              <span className="text-fg-subtle text-xs">·</span>
              <span className="text-xs text-fg-muted font-mono">
                {formatRunId(runData.run_id)}
              </span>
              <span className="ml-auto text-sm font-bold font-mono tabular-nums" style={{ color: scoreColor(runData.score.visibility_score) }}>
                {runData.score.visibility_score}
                <span className="text-fg-muted font-normal text-xs">/100</span>
              </span>
            </>
          )}
          {!runData && (
            <>
              <span className="ml-auto text-[11px] text-fg-subtle">
                ChatGPT · Google AI Overview · Perplexity · Gemini
              </span>
              {/* Backend status pill */}
              <span
                className={`flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border ${
                  backendStatus === "ok"
                    ? "border-accent-green/30 text-accent-green bg-accent-green/10"
                    : backendStatus === "error"
                    ? "border-accent-red/30 text-accent-red bg-accent-red/10"
                    : "border-border text-fg-muted"
                }`}
              >
                {backendStatus === "ok" ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : backendStatus === "error" ? (
                  <AlertCircle className="w-3 h-3" />
                ) : (
                  <Loader2 className="w-3 h-3 animate-spin" />
                )}
                {backendStatus === "ok"
                  ? "API connected"
                  : backendStatus === "error"
                  ? "API offline"
                  : "Connecting…"}
              </span>
            </>
          )}
        </div>

        {/* Page content */}
        <div className="flex-1 px-6 py-6 space-y-4">
          {/* Backend offline banner */}
          {backendStatus === "error" && (
            <div className="flex items-start gap-3 rounded-xl border border-accent-red/30 bg-accent-red/10 px-5 py-4">
              <AlertCircle className="w-4 h-4 text-accent-red mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-accent-red">
                  FastAPI backend is not running
                </p>
                <p className="text-xs text-fg-muted mt-1">
                  Start it in a separate terminal, then refresh:
                </p>
                <pre className="mt-2 text-xs font-mono text-fg bg-canvas border border-border rounded px-3 py-2">
                  source .venv/bin/activate{"\n"}
                  uvicorn api.main:app --reload --port 8000
                </pre>
              </div>
            </div>
          )}

          {/* Running state */}
          {isRunning && (
            <div className="flex flex-col items-center justify-center py-32 gap-5">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-2 border-border" />
                <Loader2 className="w-16 h-16 text-accent-blue animate-spin absolute inset-0" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-fg">
                  Analysis running…
                </p>
                <p className="text-sm text-fg-muted mt-2 max-w-sm">
                  Querying {engines.length} engine
                  {engines.length !== 1 ? "s" : ""} × up to {maxPrompts} prompts
                  via Bright Data.
                </p>
                <p className="text-xs text-fg-subtle mt-1">
                  This typically takes 1–3 minutes.
                </p>
              </div>
            </div>
          )}

          {/* Loading cached run */}
          {isLoadingRun && !isRunning && (
            <div className="flex items-center justify-center py-32 gap-3">
              <Loader2 className="w-6 h-6 text-accent-blue animate-spin" />
              <p className="text-sm text-fg-muted">Loading cached run…</p>
            </div>
          )}

          {/* Empty state */}
          {!isRunning && !isLoadingRun && !runData && (
            <EmptyState />
          )}

          {/* Results */}
          {!isRunning && !isLoadingRun && runData && (
            <>
              <MetricsRow
                score={runData.score}
                respondedCount={runData.responded_count}
                failedCount={runData.failed_count}
              />

              {failed.length > 0 && (
                <details className="rounded-xl border border-accent-yellow/30 bg-accent-yellow/5 px-5 py-3 text-xs">
                  <summary className="font-medium text-accent-yellow cursor-pointer select-none">
                    ⚠ {failed.length} failed response
                    {failed.length !== 1 ? "s" : ""} — click to expand
                  </summary>
                  <ul className="mt-3 space-y-1 font-mono text-fg-muted">
                    {failed.map((r) => (
                      <li key={`${r.engine}-${r.prompt_id}`}>
                        {r.engine} / {r.prompt_id}:{" "}
                        <span className="text-accent-red">{r.error}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <ScoreFormula score={runData.score} />

              <EngineChart score={runData.score} />

              <MentionTable
                results={runData.results}
                targetBrand={runData.config.target_brand}
                competitors={runData.config.competitors}
              />

              <CitationGap
                gaps={runData.gap_list}
                targetBrand={runData.config.target_brand}
              />

              <SentimentSection
                sentiments={sentiment}
                onRun={handleSentiment}
                isRunning={isRunningSentiment}
              />

              <RecommendationsSection
                data={recommendations}
                onRun={handleRecommendations}
                isRunning={isRunningRecs}
              />

              {/* Raw responses */}
              <details className="rounded-xl border border-border bg-canvas-subtle overflow-hidden">
                <summary className="px-5 py-3.5 text-xs font-medium text-fg-muted cursor-pointer select-none hover:text-fg transition-colors">
                  Raw Responses ({responded.length})
                </summary>
                <div className="border-t border-border divide-y divide-border">
                  {responded.map((r) => (
                    <div
                      key={`${r.engine}-${r.prompt_id}`}
                      className="px-5 py-4"
                    >
                      <p className="text-xs">
                        <span className="font-semibold text-fg">
                          {r.engine}
                        </span>
                        <span className="mx-1.5 text-fg-subtle">/</span>
                        <span className="text-fg-muted font-mono">{r.prompt_id}</span>
                        <span className="ml-2 text-fg-subtle">
                          — {r.prompt_text.slice(0, 80)}
                          {r.prompt_text.length > 80 ? "…" : ""}
                        </span>
                      </p>
                      <pre className="mt-2 text-[11px] text-fg-subtle font-mono whitespace-pre-wrap leading-relaxed bg-canvas border border-border rounded-md px-3 py-2.5 max-h-36 overflow-y-auto">
                        {r.raw_text.slice(0, 600)}
                        {r.raw_text.length > 600 ? "…" : ""}
                      </pre>
                      {r.citations.length > 0 && (
                        <p className="mt-1.5 text-[11px] text-fg-subtle">
                          Citations:{" "}
                          {r.citations
                            .slice(0, 5)
                            .map((c) => c.url)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </details>

              <div className="h-6" />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-32 gap-6 text-center">
      <div className="w-16 h-16 rounded-2xl border border-border bg-canvas-subtle flex items-center justify-center">
        <Activity className="w-7 h-7 text-fg-muted" />
      </div>
      <div>
        <p className="text-base font-semibold text-fg">
          No analysis loaded
        </p>
        <p className="text-sm text-fg-muted mt-2 max-w-sm leading-relaxed">
          Enter a brand name in the sidebar and click{" "}
          <span className="text-fg font-medium">Run Live Analysis</span>,
          or load a cached run to see results.
        </p>
      </div>
      <div className="flex flex-col items-start gap-2 text-xs text-fg-subtle bg-canvas-subtle border border-border rounded-xl px-5 py-4 max-w-xs w-full">
        <p className="font-medium text-fg-muted mb-1">Quick start</p>
        <p>1. Enter a brand (e.g. HubSpot, Notion, Figma)</p>
        <p>2. Click Research Company to auto-fill competitors</p>
        <p>3. Select AI engines to query</p>
        <p>4. Click Run Live Analysis</p>
      </div>
    </div>
  );
}
