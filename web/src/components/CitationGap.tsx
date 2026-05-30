import { cn } from "@/lib/utils";
import type { CitationGapEntry } from "@/lib/types";

interface CitationGapProps {
  gaps: CitationGapEntry[];
  targetBrand: string;
}

export function CitationGap({ gaps, targetBrand }: CitationGapProps) {
  return (
    <div className="rounded-xl border border-border bg-canvas-subtle p-5">
      <h3 className="text-sm font-semibold text-fg">
        Citation-Gap Analysis
      </h3>
      <p className="text-[11px] text-fg-muted mt-1 mb-4">
        Sources cited when competitors were recommended but{" "}
        <span className="text-accent-blue font-medium">{targetBrand}</span> was
        absent. Higher centrality = source moves more queries.
      </p>

      {gaps.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-accent-green/10 border border-accent-green/20">
          <span className="text-accent-green text-sm">✓</span>
          <p className="text-xs text-accent-green">
            No citation gaps — {targetBrand} appeared in every response that had
            citations.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                {["Domain", "Centrality", "Competitors", "Engines", "Example URL"].map(
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
              {gaps.map((gap) => (
                <tr key={gap.domain} className="hover:bg-canvas-inset/40">
                  <td className="py-2.5 pr-4 font-medium text-fg whitespace-nowrap">
                    {gap.domain}
                  </td>
                  <td className="py-2.5 pr-4">
                    <CentralityBadge score={gap.centrality_score} />
                  </td>
                  <td className="py-2.5 pr-4 text-fg-muted">
                    {gap.reaching_competitors.join(", ")}
                  </td>
                  <td className="py-2.5 pr-4 text-fg-muted">
                    {gap.reaching_engines.join(", ")}
                  </td>
                  <td className="py-2.5 pr-4 max-w-xs">
                    {gap.urls[0] ? (
                      <span
                        className="text-fg-subtle truncate block max-w-[240px]"
                        title={gap.urls[0]}
                      >
                        {gap.urls[0]}
                      </span>
                    ) : (
                      <span className="text-fg-subtle">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CentralityBadge({ score }: { score: number }) {
  const color =
    score >= 6
      ? { bg: "bg-accent-red/15", text: "text-accent-red" }
      : score >= 3
      ? { bg: "bg-accent-orange/15", text: "text-accent-orange" }
      : { bg: "bg-fg-subtle/15", text: "text-fg-muted" };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded font-mono font-semibold text-xs",
        color.bg,
        color.text
      )}
    >
      {score}
    </span>
  );
}
