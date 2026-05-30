import { Fragment } from "react";
import { cn, engineColor } from "@/lib/utils";
import type { ParsedResult } from "@/lib/types";

interface MentionTableProps {
  results: ParsedResult[];
  targetBrand: string;
  competitors: string[];
}

export function MentionTable({ results, targetBrand, competitors }: MentionTableProps) {
  const responded = results.filter((r) => r.responded);
  const allBrands = [targetBrand, ...competitors];

  if (responded.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-canvas-subtle px-5 py-4">
        <p className="text-sm font-semibold text-fg mb-1">Per-Response Mention Table</p>
        <p className="text-xs text-fg-muted">No successful responses to display.</p>
      </div>
    );
  }

  // Group rows by engine, preserving order within each group
  const grouped = responded.reduce<Record<string, typeof responded>>((acc, r) => {
    (acc[r.engine] ??= []).push(r);
    return acc;
  }, {});
  const engineOrder = Object.keys(grouped);

  return (
    <details open className="rounded-xl border border-border bg-canvas-subtle overflow-hidden">
      <summary className="px-5 py-3.5 flex items-center justify-between cursor-pointer select-none hover:bg-canvas-inset/30 transition-colors">
        <span className="text-sm font-semibold text-fg">Per-Response Mention Table</span>
        <span className="text-[11px] text-fg-muted">Position when mentioned · ★ = recommended · — = absent</span>
      </summary>
      <div className="border-t border-border px-5 pb-5 pt-4 overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2.5 pr-4 text-left font-medium text-fg-muted whitespace-nowrap">
                Prompt
              </th>
              {allBrands.map((b, i) => (
                <th
                  key={b}
                  className={cn(
                    "py-2.5 px-3 text-center font-medium whitespace-nowrap",
                    i === 0 ? "text-accent-blue" : "text-fg-muted"
                  )}
                >
                  {b}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {engineOrder.map((engine) => (
              <Fragment key={engine}>
                {/* Engine group header */}
                <tr>
                  <td
                    colSpan={allBrands.length + 1}
                    className="pt-4 pb-1.5 pr-4"
                  >
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                      style={{
                        color: engineColor(engine),
                        backgroundColor: engineColor(engine) + "18",
                        border: `1px solid ${engineColor(engine)}40`,
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: engineColor(engine) }}
                      />
                      {engineShort(engine)}
                    </span>
                  </td>
                </tr>
                {/* Rows for this engine */}
                {grouped[engine].map((r) => {
                  const mentionMap = new Map(
                    r.mentions.map((m) => [m.brand.toLowerCase(), m])
                  );
                  return (
                    <tr
                      key={`${r.engine}-${r.prompt_id}`}
                      className="border-t border-border/50 hover:bg-canvas-inset/40"
                    >
                      <td className="py-2.5 pr-4">
                        <span className="text-xs text-fg-subtle">
                          {r.prompt_text.slice(0, 60)}{r.prompt_text.length > 60 ? "…" : ""}
                        </span>
                      </td>
                      {allBrands.map((brand, i) => {
                        const mention = mentionMap.get(brand.toLowerCase());
                        return (
                          <td key={brand} className="py-2.5 px-3 text-center">
                            {mention ? (
                              <span
                                className={cn(
                                  "inline-flex items-center px-1.5 py-0.5 rounded font-mono font-medium",
                                  i === 0
                                    ? "bg-accent-green/15 text-accent-green"
                                    : "bg-canvas text-fg-muted"
                                )}
                              >
                                #{mention.position}
                                {mention.is_recommendation ? "★" : ""}
                              </span>
                            ) : (
                              <span className="text-fg-subtle">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function engineShort(engine: string): string {
  const m: Record<string, string> = {
    chatgpt: "GPT",
    google_serp: "AI Overview",
    perplexity: "Perplexity",
    gemini: "Gemini",
  };
  return m[engine] ?? engine;
}

