"use client";

import { useState, useEffect, useRef } from "react";
import {
  Loader2,
  Activity,
  AlertCircle,
  Search,
  Play,
  ChevronDown,
  ChevronRight,
  Settings2,
  Plus,
  Clock,
} from "lucide-react";
import { NavSidebar, type Section } from "@/components/NavSidebar";
import { MetricsRow } from "@/components/MetricsRow";
import { EngineChart } from "@/components/EngineChart";
import { MentionTable } from "@/components/MentionTable";
import { CitationGap } from "@/components/CitationGap";
import { GraphInsightsSection } from "@/components/GraphInsightsSection";
import { RecommendationsSection } from "@/components/RecommendationsSection";
import { OvertimeView } from "@/components/OvertimeView";
import * as api from "@/lib/api";
import { cn, scoreColor, formatRunId, engineLabel, engineColor, ALL_ENGINES } from "@/lib/utils";
import type {
  RunData,
  BrandSentiment,
  RecommendationsResponse,
  InsightsResponse,
  CachedRunMeta,
} from "@/lib/types";

const inputCls =
  "w-full px-3 py-2 rounded-md text-xs bg-canvas border border-border text-fg " +
  "placeholder:text-fg-subtle focus:outline-none focus:ring-1 focus:ring-accent-blue " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

// ── Schedule helpers ─────────────────────────────────────────────────────────
const SCHEDULE_KEY = "geo:schedule";
interface StoredSchedule { enabled: boolean; intervalDays: number; lastRunAt: string | null; }

function loadStoredSchedule(): StoredSchedule | null {
  try { const s = localStorage.getItem(SCHEDULE_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
function saveStoredSchedule(s: StoredSchedule): void {
  try { localStorage.setItem(SCHEDULE_KEY, JSON.stringify(s)); } catch {}
}
function nextRunLabel(lastRun: Date | null, days: number): string {
  const base = lastRun ?? new Date();
  const next = new Date(base.getTime() + days * 86400000);
  const diff = Math.round((next.getTime() - Date.now()) / 86400000);
  if (diff <= 0) return "due now";
  if (diff === 1) return "tomorrow";
  return `in ${diff} days`;
}

export default function Home() {
  // ── Navigation ───────────────────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState<Section>("home");
  const [unreadSections, setUnreadSections] = useState<Set<Section>>(new Set());

  function handleSectionChange(s: Section) {
    setUnreadSections((prev) => {
      if (!prev.has(s)) return prev;
      const next = new Set(prev);
      next.delete(s);
      return next;
    });
    setActiveSection(s);
  }

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
  const [maxPrompts, setMaxPrompts] = useState(5);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [showForm, setShowForm] = useState(true);

  // ── Schedule state ──────────────────────────────────────────────────────────
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDays, setScheduleDays] = useState(1);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleLastRun, setScheduleLastRun] = useState<Date | null>(null);
  const [scheduleDue, setScheduleDue] = useState(false);
  const scheduleChecked = useRef(false);

  // ── Results state ───────────────────────────────────────────────────────────
  const [runData, setRunData] = useState<RunData | null>(null);
  const [sentiment, setSentiment] = useState<BrandSentiment[] | null>(null);
  const [recommendations, setRecommendations] =
    useState<RecommendationsResponse | null>(null);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [cachedRuns, setCachedRuns] = useState<CachedRunMeta[]>([]);

  // ── Loading flags ───────────────────────────────────────────────────────────
  const [isRunning, setIsRunning] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [isLoadingRun, setIsLoadingRun] = useState(false);
  const [isRunningSentiment, setIsRunningSentiment] = useState(false);
  const [isRunningRecs, setIsRunningRecs] = useState(false);
  const [isRunningInsights, setIsRunningInsights] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<"checking" | "ok" | "error">(
    "checking"
  );

  const isBusy = isRunning || isResearching || isLoadingRun;

  // ── Restore per-run cache from localStorage when run_id changes ─────────────
  useEffect(() => {
    if (!runData?.run_id) return;
    const id = runData.run_id;
    try {
      const i = localStorage.getItem(`geo:insights:${id}`);
      if (i) setInsights(JSON.parse(i));
      const s = localStorage.getItem(`geo:sentiment:${id}`);
      if (s) setSentiment(JSON.parse(s));
      const r = localStorage.getItem(`geo:recommendations:${id}`);
      if (r) setRecommendations(JSON.parse(r));
    } catch {}
  }, [runData?.run_id]);

  // ── Backend health check ─────────────────────────────────────────────────────
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    fetch(`${base}/api/health`, { signal: AbortSignal.timeout(4000) })
      .then((r) => {
        if (r.ok) {
          setBackendStatus("ok");
          api.listRuns().then(setCachedRuns).catch(() => {});
        } else {
          setBackendStatus("error");
        }
      })
      .catch(() => setBackendStatus("error"));
  }, []);

  // ── Schedule: load from localStorage on mount, check if due ─────────────────
  useEffect(() => {
    if (scheduleChecked.current) return;
    scheduleChecked.current = true;
    const stored = loadStoredSchedule();
    if (!stored) return;
    setScheduleEnabled(stored.enabled);
    setScheduleDays(stored.intervalDays);
    if (stored.lastRunAt) {
      const last = new Date(stored.lastRunAt);
      setScheduleLastRun(last);
      if (stored.enabled) {
        const due = new Date(last.getTime() + stored.intervalDays * 86400000);
        if (Date.now() >= due.getTime()) setScheduleDue(true);
      }
    }
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────
  async function handleRun() {
    setError(null);
    setIsRunning(true);
    setActiveSection("home");
    setSentiment(null);
    setRecommendations(null);
    setInsights(null);
    setUnreadSections(new Set());

    let runId: string | null = null;
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
      runId = data.run_id;
      setRunData(data);
      setShowForm(false);
      setScheduleDue(false);
      const now = new Date();
      setScheduleLastRun(now);
      saveStoredSchedule({ enabled: scheduleEnabled, intervalDays: scheduleDays, lastRunAt: now.toISOString() });
      api.listRuns().then(setCachedRuns).catch(console.error);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRunning(false);
    }

    // Auto-run insights + recommendations in parallel after analysis
    if (!runId) return;
    setIsRunningInsights(true);
    setIsRunningRecs(true);
    const [insightsResult, recsResult] = await Promise.allSettled([
      api.runInsights(runId),
      api.runRecommendations(runId, undefined),
    ]);
    setIsRunningInsights(false);
    setIsRunningRecs(false);
    const autoErrors: string[] = [];
    if (insightsResult.status === "fulfilled") {
      setInsights(insightsResult.value);
      setUnreadSections((prev) => new Set([...prev, "insights" as Section]));
      try { localStorage.setItem(`geo:insights:${runId}`, JSON.stringify(insightsResult.value)); } catch {}
    } else {
      autoErrors.push(`Insights: ${insightsResult.reason instanceof Error ? insightsResult.reason.message : String(insightsResult.reason)}`);
    }
    if (recsResult.status === "fulfilled") {
      setRecommendations(recsResult.value);
      setUnreadSections((prev) => new Set([...prev, "recommendations" as Section]));
      try { localStorage.setItem(`geo:recommendations:${runId}`, JSON.stringify(recsResult.value)); } catch {}
    } else {
      autoErrors.push(`Recommendations: ${recsResult.reason instanceof Error ? recsResult.reason.message : String(recsResult.reason)}`);
    }
    if (autoErrors.length > 0) setError(autoErrors.join("\n"));
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
    setInsights(null);
    setUnreadSections(new Set());
    setActiveSection("home");
    try {
      const data = await api.loadRun(runId);
      setRunData(data);
      setShowForm(false);
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
      try { localStorage.setItem(`geo:sentiment:${runData.run_id}`, JSON.stringify(result)); } catch {}
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
      try { localStorage.setItem(`geo:recommendations:${runData.run_id}`, JSON.stringify(result)); } catch {}
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRunningRecs(false);
    }
  }

  async function handleInsights() {
    if (!runData) return;
    setIsRunningInsights(true);
    setError(null);
    try {
      const result = await api.runInsights(runData.run_id);
      setInsights(result);
      try { localStorage.setItem(`geo:insights:${runData.run_id}`, JSON.stringify(result)); } catch {}
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRunningInsights(false);
    }
  }

  function handleSaveSchedule() {
    const stored: StoredSchedule = {
      enabled: true,
      intervalDays: scheduleDays,
      lastRunAt: scheduleLastRun?.toISOString() ?? null,
    };
    saveStoredSchedule(stored);
    setScheduleEnabled(true);
  }

  function handleDisableSchedule() {
    saveStoredSchedule({ enabled: false, intervalDays: scheduleDays, lastRunAt: scheduleLastRun?.toISOString() ?? null });
    setScheduleEnabled(false);
    setScheduleDue(false);
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const responded = runData?.results.filter((r) => r.responded) ?? [];
  const failed = runData?.results.filter((r) => !r.responded) ?? [];
  const estRequests = maxPrompts * engines.length;
  const loadingSections = new Set<Section>([
    ...(isRunningInsights ? (["insights"] as Section[]) : []),
    ...(isRunningRecs ? (["recommendations"] as Section[]) : []),
  ]);

  const toggleEngine = (eng: string) => {
    setEngines((prev) =>
      prev.includes(eng) ? prev.filter((e) => e !== eng) : [...prev, eng]
    );
  };

  // ── Delete run ───────────────────────────────────────────────────────────────
  async function handleDeleteRun(runId: string) {
    try {
      await api.deleteRun(runId);
      setCachedRuns((prev) => prev.filter((r) => r.run_id !== runId));
      // If the deleted run was the active one, clear the view
      if (runData?.run_id === runId) {
        setRunData(null);
        setShowForm(true);
      }
    } catch (e) {
      console.error("Failed to delete run:", e);
    }
  }

  // ── Section header label ─────────────────────────────────────────────────────
  const SECTION_LABELS: Record<Section, string> = {
    home: "Home",
    insights: "Insights",
    overtime: "Overtime",
    recommendations: "Recommendations",
    responses: "Responses",
  };

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <NavSidebar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        runData={runData}
        cachedRuns={cachedRuns}
        onLoadRun={handleLoadRun}
        onDeleteRun={handleDeleteRun}
        isLoadingRun={isLoadingRun}
        backendStatus={backendStatus}
        loadingSections={loadingSections}
        unreadSections={unreadSections}
      />

      <main className="flex-1 overflow-y-auto flex flex-col">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-3 border-b border-border bg-canvas/80 backdrop-blur-sm shrink-0">
          <h1 className="text-sm font-semibold text-fg">
            {SECTION_LABELS[activeSection]}
          </h1>
          {runData && (
            <>
              <span className="text-fg-subtle text-xs">·</span>
              <span className="text-xs text-fg-muted">{runData.config.target_brand}</span>
              <span className="text-fg-subtle text-xs">·</span>
              <span className="text-xs text-fg-muted font-mono">
                {formatRunId(runData.run_id)}
              </span>
              <span
                className="ml-auto text-sm font-bold font-mono tabular-nums"
                style={{ color: scoreColor(runData.score.visibility_score) }}
              >
                {runData.score.visibility_score}
                <span className="text-fg-muted font-normal text-xs">/100</span>
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

          {/* ── HOME ──────────────────────────────────────────────────────── */}
          {activeSection === "home" && (
            <>
              {/* Running state */}
              {isRunning && (
                <div className="flex flex-col items-center justify-center py-24 gap-5">
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
                      {engines.length !== 1 ? "s" : ""} × up to {maxPrompts}{" "}
                      prompts via Bright Data.
                    </p>
                    <p className="text-xs text-fg-subtle mt-1">
                      This typically takes 1–3 minutes.
                    </p>
                  </div>
                </div>
              )}

              {/* Loading cached run */}
              {isLoadingRun && !isRunning && (
                <div className="flex items-center justify-center py-24 gap-3">
                  <Loader2 className="w-6 h-6 text-accent-blue animate-spin" />
                  <p className="text-sm text-fg-muted">Loading cached run…</p>
                </div>
              )}

              {!isRunning && !isLoadingRun && (
                <>
                  {/* ── FORM VIEW: no run yet, or user clicked "New Analysis" ── */}
                  {(showForm || !runData) && (
                    <div className="rounded-xl border border-border bg-canvas-subtle px-6 py-8">
                      {/* Back link — only when a run already exists */}
                      {runData && (
                        <button
                          onClick={() => setShowForm(false)}
                          className="flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg transition-colors mb-6"
                        >
                          <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                          Back to {runData.config.target_brand}
                        </button>
                      )}

                      {/* Hero heading */}
                      <div className="text-center mb-7">
                        <h2 className="text-2xl font-semibold text-fg tracking-tight">
                          How does AI talk about your brand?
                        </h2>
                        <p className="text-sm text-fg-muted mt-2">
                          Analyze your visibility across AI search engines in minutes.
                        </p>
                      </div>

                      {/* Brand input — centered, prominent */}
                      <div className="max-w-2xl mx-auto mb-3">
                        <div className="relative">
                          <input
                            type="text"
                            value={brand}
                            onChange={(e) => setBrand(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !isBusy && brand.trim() && engines.length > 0)
                                handleRun();
                            }}
                            placeholder="Enter your brand name, e.g. HubSpot"
                            disabled={isBusy}
                            className={cn(
                              "w-full px-6 py-5 pr-16 rounded-xl text-xl font-medium",
                              "bg-canvas border-2 border-border text-fg placeholder:text-fg-subtle placeholder:font-normal",
                              "focus:outline-none focus:border-accent-blue transition-colors",
                              "disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                          />
                          <button
                            onClick={handleRun}
                            disabled={isBusy || !brand.trim() || engines.length === 0}
                            className={cn(
                              "absolute right-3 top-1/2 -translate-y-1/2",
                              "w-10 h-10 rounded-lg flex items-center justify-center",
                              "bg-accent-blue hover:bg-accent-blue/80 text-white",
                              "disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            )}
                          >
                            <Play className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      {/* Auto-research */}
                      <div className="max-w-2xl mx-auto mb-6">
                        <button
                          onClick={handleResearch}
                          disabled={isBusy || !brand.trim()}
                          className={cn(
                            "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium",
                            "border border-border bg-btn-secondary hover:bg-btn-secondary-hover text-fg-muted hover:text-fg transition-colors",
                            "disabled:opacity-40 disabled:cursor-not-allowed"
                          )}
                        >
                          {isResearching ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Search className="w-3.5 h-3.5" />
                          )}
                          {isResearching
                            ? "Finding competitors and niche…"
                            : "Find competitors and niche automatically"}
                        </button>
                      </div>

                      {/* Always-visible engine + prompt summary */}
                      <div className="max-w-2xl mx-auto mb-5 flex items-center justify-center gap-2 flex-wrap">
                        {engines.map((eng) => {
                          const color = engineColor(eng);
                          return (
                            <span
                              key={eng}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium"
                              style={{
                                color,
                                backgroundColor: color + "18",
                                border: `1px solid ${color}40`,
                              }}
                            >
                              {engineLabel(eng)}
                            </span>
                          );
                        })}
                        <span className="text-fg-subtle text-[11px]">·</span>
                        <span className="text-[11px] text-fg-muted font-mono">
                          {maxPrompts} prompts/engine
                        </span>
                        <span className="text-fg-subtle text-[11px]">·</span>
                        <span className="text-[11px] text-fg-subtle">
                          ~{estRequests} requests
                        </span>
                      </div>

                      {/* Configure collapsible */}
                      <div className="max-w-2xl mx-auto border-t border-border pt-4">
                        <button
                          onClick={() => setAdvancedOpen((o) => !o)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg w-full text-xs font-medium transition-colors",
                            advancedOpen
                              ? "bg-canvas border border-border text-fg"
                              : "bg-canvas-subtle border border-border text-fg-muted hover:text-fg hover:border-fg-subtle"
                          )}
                        >
                          <Settings2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="flex-1 text-left">Configure competitors, market &amp; engines</span>
                          {advancedOpen ? (
                            <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                          )}
                        </button>

                        {advancedOpen && (
                          <div className="mt-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-fg-muted uppercase tracking-wider mb-1.5">
                                  Competitors{" "}
                                  <span className="normal-case">(one per line)</span>
                                </label>
                                <textarea
                                  value={competitors}
                                  onChange={(e) => setCompetitors(e.target.value)}
                                  rows={4}
                                  disabled={isBusy}
                                  className={cn(inputCls, "resize-none")}
                                  placeholder={"Salesforce\nPipedrive\nActiveCampaign"}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-fg-muted uppercase tracking-wider mb-1.5">
                                  Market / Category
                                </label>
                                <textarea
                                  value={market}
                                  onChange={(e) => setMarket(e.target.value)}
                                  rows={4}
                                  disabled={isBusy}
                                  className={cn(inputCls, "resize-none")}
                                  placeholder="CRM software for small businesses"
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap items-end gap-6 pt-1">
                              <div>
                                <p className="text-xs font-medium text-fg-muted uppercase tracking-wider mb-2">
                                  AI Engines
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {ALL_ENGINES.map((eng) => {
                                    const on = engines.includes(eng);
                                    const color = engineColor(eng);
                                    return (
                                      <button
                                        key={eng}
                                        onClick={() => toggleEngine(eng)}
                                        disabled={isBusy}
                                        className={cn(
                                          "px-3 py-1 rounded-full text-xs font-medium border transition-all",
                                          "disabled:opacity-40 disabled:cursor-not-allowed",
                                          on
                                            ? ""
                                            : "border-border text-fg-muted hover:text-fg hover:border-fg-muted"
                                        )}
                                        style={
                                          on
                                            ? { color, borderColor: color + "60", backgroundColor: color + "18" }
                                            : undefined
                                        }
                                      >
                                        {engineLabel(eng)}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <div>
                                  <p className="text-xs font-medium text-fg">Variation Engine</p>
                                  <p className="text-[11px] text-fg-muted">Market-specific prompts via gpt-4o-mini</p>
                                </div>
                                <button
                                  role="switch"
                                  aria-checked={useVariation}
                                  onClick={() => setUseVariation((v) => !v)}
                                  disabled={isBusy}
                                  className={cn(
                                    "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors border border-border",
                                    useVariation ? "bg-accent-green/70" : "bg-canvas",
                                    "disabled:opacity-40 disabled:cursor-not-allowed"
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

                              {useVariation && (
                                <div>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <p className="text-xs font-medium text-fg-muted uppercase tracking-wider">
                                      Prompts per Engine
                                    </p>
                                    <span className="ml-3 text-xs font-mono text-accent-blue">{maxPrompts}</span>
                                  </div>
                                  <input
                                    type="range"
                                    min={5}
                                    max={20}
                                    value={maxPrompts}
                                    onChange={(e) => setMaxPrompts(Number(e.target.value))}
                                    disabled={isBusy}
                                    className="w-32 accent-accent-blue"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {error && (
                        <div className="max-w-2xl mx-auto mt-4 rounded-md bg-accent-red/10 border border-accent-red/30 px-3 py-2">
                          <p className="text-xs text-accent-red leading-relaxed">{error}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── RESULTS VIEW: run complete ─────────────────────────── */}
                  {runData && !showForm && (
                    <>
                      {/* Brand header */}
                      <div className="rounded-xl border border-border bg-canvas-subtle px-6 py-6">
                        <div className="flex items-start justify-between gap-6">
                          <div className="min-w-0">
                            <h2 className="text-4xl font-bold text-fg tracking-tight truncate">
                              {runData.config.target_brand}
                            </h2>
                            <p className="text-sm text-fg-muted mt-1.5 truncate">
                              {runData.config.market}
                            </p>
                            <div className="flex items-center gap-2 mt-3 flex-wrap">
                              {runData.config.engines.map((eng) => {
                                const color = engineColor(eng);
                                return (
                                  <span
                                    key={eng}
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                    style={{
                                      color,
                                      backgroundColor: color + "18",
                                      border: `1px solid ${color}40`,
                                    }}
                                  >
                                    {engineLabel(eng)}
                                  </span>
                                );
                              })}
                              <span className="text-fg-subtle text-[11px]">·</span>
                              <span className="text-[11px] text-fg-subtle font-mono">
                                {formatRunId(runData.run_id)}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <div
                              className="text-4xl font-bold tabular-nums"
                              style={{ color: scoreColor(runData.score.visibility_score) }}
                            >
                              {runData.score.visibility_score}
                              <span className="text-lg font-normal text-fg-muted">/100</span>
                            </div>
                            <button
                              onClick={() => {
                                setShowForm(true);
                                setAdvancedOpen(false);
                              }}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium w-full justify-center",
                                "border border-border bg-btn-secondary hover:bg-btn-secondary-hover text-fg transition-colors"
                              )}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              New Analysis
                            </button>
                            <button
                              onClick={() => setScheduleOpen((o) => !o)}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium w-full justify-center",
                                "border transition-colors",
                                scheduleOpen || scheduleEnabled
                                  ? "border-accent-blue/40 bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/15"
                                  : "border-border bg-btn-secondary hover:bg-btn-secondary-hover text-fg-muted hover:text-fg"
                              )}
                            >
                              <Clock className="w-3.5 h-3.5" />
                              Schedule
                              {scheduleEnabled && (
                                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-accent-green inline-block" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Schedule panel */}
                      {scheduleOpen && (
                        <div className="rounded-xl border border-border bg-canvas-subtle px-5 py-4">
                          <div className="flex items-center justify-between gap-4 mb-3">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-fg">Recurring Analysis</p>
                              {scheduleEnabled && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent-green/15 text-accent-green border border-accent-green/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                                  Active
                                </span>
                              )}
                            </div>
                            {scheduleEnabled && (
                              <button
                                onClick={handleDisableSchedule}
                                className="text-xs text-fg-muted hover:text-accent-red transition-colors"
                              >
                                Disable
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs text-fg-muted">Run every</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setScheduleDays((d) => Math.max(1, d - 1))}
                                className="w-6 h-6 rounded border border-border bg-canvas hover:bg-canvas-subtle text-fg-muted hover:text-fg text-sm leading-none flex items-center justify-center transition-colors"
                              >
                                −
                              </button>
                              <span className="text-sm font-mono font-semibold text-fg w-7 text-center tabular-nums">
                                {scheduleDays}
                              </span>
                              <button
                                onClick={() => setScheduleDays((d) => Math.min(365, d + 1))}
                                className="w-6 h-6 rounded border border-border bg-canvas hover:bg-canvas-subtle text-fg-muted hover:text-fg text-sm leading-none flex items-center justify-center transition-colors"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-xs text-fg-muted">
                              day{scheduleDays !== 1 ? "s" : ""}
                            </span>

                            {scheduleEnabled && (
                              <>
                                <span className="text-fg-subtle text-xs">·</span>
                                <span className="text-xs text-fg-muted">
                                  Next run: <span className="text-fg font-medium">{nextRunLabel(scheduleLastRun, scheduleDays)}</span>
                                </span>
                              </>
                            )}

                            <button
                              onClick={handleSaveSchedule}
                              className={cn(
                                "ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium",
                                "bg-btn-primary hover:bg-btn-primary-hover text-white transition-colors"
                              )}
                            >
                              {scheduleEnabled ? "Update" : "Enable Schedule"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Due notification */}
                      {scheduleDue && (
                        <div className="flex items-center gap-3 rounded-xl border border-accent-blue/30 bg-accent-blue/8 px-4 py-3">
                          <Clock className="w-4 h-4 text-accent-blue shrink-0" />
                          <p className="text-xs text-fg flex-1">
                            A scheduled analysis for <span className="font-medium">{runData.config.target_brand}</span> is due.
                          </p>
                          <button
                            onClick={() => { setScheduleDue(false); handleRun(); }}
                            className="text-xs font-medium text-accent-blue hover:text-accent-blue/80 transition-colors shrink-0"
                          >
                            Run now
                          </button>
                          <button
                            onClick={() => setScheduleDue(false)}
                            className="text-xs text-fg-muted hover:text-fg transition-colors shrink-0"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}

                      {error && (
                        <div className="flex items-start gap-3 rounded-xl border border-accent-red/30 bg-accent-red/10 px-4 py-3">
                          <AlertCircle className="w-4 h-4 text-accent-red mt-0.5 shrink-0" />
                          <p className="text-xs text-accent-red leading-relaxed">{error}</p>
                        </div>
                      )}

                      <MetricsRow
                        score={runData.score}
                        respondedCount={runData.responded_count}
                        failedCount={runData.failed_count}
                      />
                      <EngineChart score={runData.score} />
                    </>
                  )}

                  {/* Empty state when no run and no form (shouldn't normally occur) */}
                  {!runData && !showForm && <EmptyState />}
                </>
              )}
            </>
          )}

          {/* ── RESPONSES ─────────────────────────────────────────────────── */}
          {activeSection === "responses" && runData && (
            <>
              {failed.length > 0 && (
                <details className="rounded-xl border border-accent-yellow/30 bg-accent-yellow/5 px-5 py-3 text-xs">
                  <summary className="font-medium text-accent-yellow cursor-pointer select-none">
                    ⚠ {failed.length} failed response
                    {failed.length !== 1 ? "s" : ""} — click to expand
                  </summary>
                  <ul className="mt-3 space-y-1.5 font-mono text-fg-muted">
                    {failed.map((r) => (
                      <li key={`${r.engine}-${r.prompt_id}`} className="flex items-center gap-2">
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
                          style={{
                            color: engineColor(r.engine),
                            backgroundColor: engineColor(r.engine) + "20",
                          }}
                        >
                          {r.engine}
                        </span>
                        <span className="text-fg-subtle">{r.prompt_id}:</span>
                        <span className="text-accent-red">{r.error || "no response"}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <MentionTable
                results={runData.results}
                targetBrand={runData.config.target_brand}
                competitors={runData.config.competitors}
              />

              <CitationGap
                gaps={runData.gap_list}
                targetBrand={runData.config.target_brand}
              />

              {/* Raw responses */}
              <details className="rounded-xl border border-border bg-canvas-subtle overflow-hidden">
                <summary className="px-5 py-3.5 text-xs font-medium text-fg-muted cursor-pointer select-none hover:text-fg transition-colors">
                  Raw Responses ({responded.length})
                </summary>
                <div className="border-t border-border divide-y divide-border">
                  {responded.map((r) => (
                    <div key={`${r.engine}-${r.prompt_id}`} className="px-5 py-4">
                      <p className="text-xs flex items-center gap-1.5 flex-wrap">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{
                            color: engineColor(r.engine),
                            backgroundColor: engineColor(r.engine) + "20",
                            border: `1px solid ${engineColor(r.engine)}40`,
                          }}
                        >
                          {r.engine}
                        </span>
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
                          {r.citations.slice(0, 5).map((c) => c.url).join(" · ")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            </>
          )}

          {/* ── INSIGHTS ──────────────────────────────────────────────────── */}
          {activeSection === "insights" && runData && (
            <GraphInsightsSection
              insights={insights}
              onRun={handleInsights}
              isRunning={isRunningInsights}
              sentiments={sentiment}
              onRunSentiment={handleSentiment}
              isRunningSentiment={isRunningSentiment}
              runData={runData}
            />
          )}

          {/* ── OVERTIME ──────────────────────────────────────────────────── */}
          {activeSection === "overtime" && (
            <OvertimeView
              cachedRuns={cachedRuns}
              currentRunId={runData?.run_id ?? null}
              onLoadRun={handleLoadRun}
            />
          )}

          {/* ── RECOMMENDATIONS ───────────────────────────────────────────── */}
          {activeSection === "recommendations" && runData && (
            <RecommendationsSection
              data={recommendations}
              onRun={handleRecommendations}
              isRunning={isRunningRecs}
            />
          )}

          <div className="h-6" />
        </div>
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
      <div className="w-14 h-14 rounded-2xl border border-border bg-canvas-subtle flex items-center justify-center">
        <Activity className="w-6 h-6 text-fg-muted" />
      </div>
      <div>
        <p className="text-sm font-semibold text-fg">No analysis loaded</p>
        <p className="text-sm text-fg-muted mt-2 max-w-sm leading-relaxed">
          Fill in the form above and click{" "}
          <span className="text-fg font-medium">Run Live Analysis</span>, or
          select a recent run from the sidebar.
        </p>
      </div>
    </div>
  );
}
