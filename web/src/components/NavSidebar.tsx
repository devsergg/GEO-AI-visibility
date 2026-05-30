"use client";

import { useState } from "react";
import {
  Radio,
  Home,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Lightbulb,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import { cn, formatRunId } from "@/lib/utils";
import type { CachedRunMeta, RunData } from "@/lib/types";

export type Section = "home" | "insights" | "overtime" | "recommendations" | "responses";

const NAV_ITEMS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "insights", label: "Insights", icon: Sparkles },
  { id: "overtime", label: "Overtime", icon: TrendingUp },
  { id: "recommendations", label: "Recommendations", icon: Lightbulb },
  { id: "responses", label: "Responses", icon: MessageSquare },
];

interface NavSidebarProps {
  activeSection: Section;
  onSectionChange: (s: Section) => void;
  runData: RunData | null;
  cachedRuns: CachedRunMeta[];
  onLoadRun: (runId: string) => void;
  onDeleteRun: (runId: string) => void;
  isLoadingRun: boolean;
  backendStatus: "checking" | "ok" | "error";
  loadingSections: Set<Section>;
  unreadSections: Set<Section>;
}

export function NavSidebar({
  activeSection,
  onSectionChange,
  runData,
  cachedRuns,
  onLoadRun,
  onDeleteRun,
  isLoadingRun,
  backendStatus,
  loadingSections,
  unreadSections,
}: NavSidebarProps) {
  const [runsOpen, setRunsOpen] = useState(true);

  return (
    <aside className="flex flex-col w-52 shrink-0 h-screen bg-canvas-subtle border-r border-border overflow-y-auto">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-accent-blue/20 border border-accent-blue/40 flex items-center justify-center shrink-0">
            <Radio className="w-3.5 h-3.5 text-accent-blue" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-fg leading-none">
              GEO Command
            </p>
            <p className="text-[10px] text-fg-muted mt-0.5">
              AI Visibility Intelligence
            </p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="px-2 pt-3 pb-1 shrink-0">
        <p className="px-2 mb-1.5 text-[10px] font-semibold text-fg-subtle uppercase tracking-widest">
          Sections
        </p>
        <div className="space-y-0.5">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = activeSection === id;
            const isLoading = loadingSections.has(id);
            const isUnread = !isActive && unreadSections.has(id);
            return (
              <button
                key={id}
                onClick={() => onSectionChange(id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors text-left",
                  isActive
                    ? "bg-accent-blue/15 text-accent-blue font-medium"
                    : "text-fg-muted hover:bg-canvas hover:text-fg"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {isLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin text-fg-muted shrink-0" />
                ) : isUnread ? (
                  <CheckCircle2 className="w-3 h-3 text-accent-green shrink-0" />
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="h-px bg-border mx-3 my-2 shrink-0" />

      {/* Recent runs */}
      <div className="shrink-0">
        <button
          onClick={() => setRunsOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-2 text-[11px] font-medium text-fg-muted hover:text-fg transition-colors"
        >
          <span>Recent Runs ({cachedRuns.length})</span>
          {runsOpen ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </button>
        {runsOpen && (
          <div className="px-2 pb-2 space-y-0.5">
            {cachedRuns.length === 0 ? (
              <p className="px-3 py-2 text-[11px] text-fg-subtle">
                No cached runs yet.
              </p>
            ) : (
              cachedRuns.slice(0, 10).map((r) => {
                const isCurrent = runData?.run_id === r.run_id;
                return (
                  <div
                    key={r.run_id}
                    className={cn(
                      "group flex items-center gap-1 rounded-md transition-colors",
                      isCurrent ? "bg-canvas border border-border" : "hover:bg-canvas"
                    )}
                  >
                    <button
                      onClick={() => onLoadRun(r.run_id)}
                      disabled={isLoadingRun}
                      className="flex-1 min-w-0 text-left px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <p className="text-[11px] font-medium text-fg truncate">
                        {r.target_brand}
                      </p>
                      <p className="text-[10px] text-fg-subtle font-mono">
                        {formatRunId(r.run_id)}
                      </p>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteRun(r.run_id);
                      }}
                      disabled={isLoadingRun}
                      title="Remove from history"
                      className="shrink-0 mr-1.5 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-canvas-inset text-fg-subtle hover:text-accent-red transition-all disabled:pointer-events-none"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Backend status */}
      <div className="px-4 py-3 border-t border-border shrink-0">
        <div
          className={cn(
            "flex items-center gap-1.5 text-[10px]",
            backendStatus === "ok"
              ? "text-accent-green"
              : backendStatus === "error"
              ? "text-accent-red"
              : "text-fg-muted"
          )}
        >
          {backendStatus === "ok" ? (
            <CheckCircle2 className="w-3 h-3 shrink-0" />
          ) : backendStatus === "error" ? (
            <AlertCircle className="w-3 h-3 shrink-0" />
          ) : (
            <Loader2 className="w-3 h-3 animate-spin shrink-0" />
          )}
          {backendStatus === "ok"
            ? "API connected"
            : backendStatus === "error"
            ? "API offline"
            : "Connecting…"}
        </div>
      </div>
    </aside>
  );
}
