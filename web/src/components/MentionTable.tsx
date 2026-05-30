import { cn } from "@/lib/utils";
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
      <Section title="Per-Response Mention Table">
        <p className="text-xs text-fg-muted">No successful responses to display.</p>
      </Section>
    );
  }

  return (
    <Section
      title="Per-Response Mention Table"
      subtitle="Position when mentioned · ★ = recommended · — = absent"
    >
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2.5 pr-4 text-left font-medium text-fg-muted whitespace-nowrap">
                Engine / Prompt
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
          <tbody className="divide-y divide-border">
            {responded.map((r) => {
              const mentionMap = new Map(
                r.mentions.map((m) => [m.brand.toLowerCase(), m])
              );
              return (
                <tr key={`${r.engine}-${r.prompt_id}`} className="hover:bg-canvas-inset/40">
                  <td className="py-2.5 pr-4 text-fg-muted whitespace-nowrap">
                    <span className="font-medium text-fg">{engineShort(r.engine)}</span>
                    <span className="ml-2 text-fg-subtle">
                      {r.prompt_text.slice(0, 55)}{r.prompt_text.length > 55 ? "…" : ""}
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
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function engineShort(engine: string): string {
  const m: Record<string, string> = {
    chatgpt: "GPT",
    google_serp: "AI Overview",
    perplexity: "Perplexity",
    gemini: "Gemini",
    google_ai_mode: "AI Mode",
  };
  return m[engine] ?? engine;
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-canvas-subtle p-5">
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {subtitle && (
        <p className="text-[11px] text-fg-muted mt-1 mb-4">{subtitle}</p>
      )}
      {!subtitle && <div className="mt-4" />}
      {children}
    </div>
  );
}
