"use client";

import { useMemo, useState } from "react";
import { engineColor } from "@/lib/utils";
import type { RunData } from "@/lib/types";

interface Props {
  runData: RunData;
}

interface GNode {
  id: string;
  label: string;
  fullLabel: string;
  type: "engine" | "target" | "competitor" | "domain";
  x: number;
  y: number;
  count: number;
}

interface GEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  strokeWidth: number;
  color: string;
}

const R = 28;
const COL = [90, 390, 690];
const ROW_H = 78;
const PAD_Y = 52;
const SVG_W = 780;

function engineShort(e: string): string {
  const map: Record<string, string> = {
    chatgpt: "ChatGPT",
    perplexity: "Perplx.",
    grok: "Grok",
    google_serp: "AI Ov.",
    gemini: "Gemini",
  };
  return map[e] ?? e.slice(0, 7);
}

function nodeColor(type: GNode["type"], id: string): string {
  if (type === "engine") return engineColor(id.replace("engine:", ""));
  if (type === "target") return "#3fb950";
  if (type === "competitor") return "#6e7681";
  return "#e3b341";
}

export function GeoGraphViz({ runData }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const { nodes, edges, svgH } = useMemo(() => {
    const { results, config } = runData;
    const { target_brand, competitors } = config;
    const responded = results.filter((r) => r.responded);

    // Engine nodes
    const engineSet = new Set(responded.map((r) => r.engine));
    const engineList = Array.from(engineSet);

    // Brand mention counts
    const brandMentionCount = new Map<string, number>();
    for (const r of responded) {
      for (const m of r.mentions) {
        const key = m.brand.toLowerCase();
        brandMentionCount.set(key, (brandMentionCount.get(key) ?? 0) + 1);
      }
    }

    // Brands: target first, competitors sorted by mention count
    const allBrands = [
      target_brand,
      ...(competitors ?? [])
        .filter((c) => c.toLowerCase() !== target_brand.toLowerCase())
        .sort(
          (a, b) =>
            (brandMentionCount.get(b.toLowerCase()) ?? 0) -
            (brandMentionCount.get(a.toLowerCase()) ?? 0)
        )
        .slice(0, 5),
    ];
    const brandLower = new Map(allBrands.map((b) => [b.toLowerCase(), b]));

    // Domain nodes: top 8 by citation count
    const domainCount = new Map<string, number>();
    for (const r of responded) {
      for (const c of r.citations) {
        domainCount.set(c.domain, (domainCount.get(c.domain) ?? 0) + 1);
      }
    }
    const domainList = Array.from(domainCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([d]) => d);
    const domainSet = new Set(domainList);

    // Layout helper: vertically centre a column's nodes within the total row count
    const rows = Math.max(engineList.length, allBrands.length, domainList.length);
    const svgH = PAD_Y * 2 + rows * ROW_H;

    function colY(listLen: number, i: number): number {
      const colH = listLen * ROW_H;
      const startY = PAD_Y + (rows * ROW_H - colH) / 2 + ROW_H / 2;
      return startY + i * ROW_H;
    }

    const engineNodes: GNode[] = engineList.map((e, i) => ({
      id: `engine:${e}`,
      label: engineShort(e),
      fullLabel: e,
      type: "engine",
      x: COL[0],
      y: colY(engineList.length, i),
      count: responded.filter((r) => r.engine === e).length,
    }));

    const brandNodes: GNode[] = allBrands.map((b, i) => ({
      id: `brand:${b}`,
      label: b.length > 9 ? b.slice(0, 8) + "…" : b,
      fullLabel: b,
      type: b.toLowerCase() === target_brand.toLowerCase() ? "target" : "competitor",
      x: COL[1],
      y: colY(allBrands.length, i),
      count: brandMentionCount.get(b.toLowerCase()) ?? 0,
    }));

    const domainNodes: GNode[] = domainList.map((d, i) => {
      const short = d.replace(/^www\./, "");
      return {
        id: `domain:${d}`,
        label: short.length > 13 ? short.slice(0, 12) + "…" : short,
        fullLabel: d,
        type: "domain",
        x: COL[2],
        y: colY(domainList.length, i),
        count: domainCount.get(d) ?? 0,
      };
    });

    const allNodes = [...engineNodes, ...brandNodes, ...domainNodes];

    // Edges: engine → brand (mention co-occurrence)
    const ebMap = new Map<string, number>();
    for (const r of responded) {
      for (const m of r.mentions) {
        const canonical = brandLower.get(m.brand.toLowerCase());
        if (!canonical) continue;
        const key = `engine:${r.engine}###brand:${canonical}`;
        ebMap.set(key, (ebMap.get(key) ?? 0) + 1);
      }
    }

    // Edges: brand → domain (brand mentioned in same response as citation)
    const bdMap = new Map<string, number>();
    for (const r of responded) {
      if (r.mentions.length === 0 || r.citations.length === 0) continue;
      const responseDomains = r.citations.map((c) => c.domain).filter((d) => domainSet.has(d));
      if (responseDomains.length === 0) continue;
      for (const m of r.mentions) {
        const canonical = brandLower.get(m.brand.toLowerCase());
        if (!canonical) continue;
        for (const d of responseDomains) {
          const key = `brand:${canonical}###domain:${d}`;
          bdMap.set(key, (bdMap.get(key) ?? 0) + 1);
        }
      }
    }

    const rawEdges: Omit<GEdge, "strokeWidth">[] = [];
    for (const [key, weight] of ebMap) {
      const [src, tgt] = key.split("###");
      const engine = src.replace("engine:", "");
      rawEdges.push({ id: key, source: src, target: tgt, weight, color: engineColor(engine) });
    }
    for (const [key, weight] of bdMap) {
      const [src, tgt] = key.split("###");
      rawEdges.push({ id: key, source: src, target: tgt, weight, color: "#58a6ff" });
    }

    const maxW = Math.max(1, ...rawEdges.map((e) => e.weight));
    const edges: GEdge[] = rawEdges.map((e) => ({
      ...e,
      strokeWidth: 0.8 + (e.weight / maxW) * 3.2,
    }));

    return { nodes: allNodes, edges, svgH };
  }, [runData]);

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const { connectedEdgeSet, connectedNodeSet } = useMemo(() => {
    if (!hovered) return { connectedEdgeSet: null, connectedNodeSet: null };
    const edgeSet = new Set(
      edges.filter((e) => e.source === hovered || e.target === hovered).map((e) => e.id)
    );
    const nodeSet = new Set<string>();
    for (const e of edges) {
      if (edgeSet.has(e.id)) {
        nodeSet.add(e.source);
        nodeSet.add(e.target);
      }
    }
    return { connectedEdgeSet: edgeSet, connectedNodeSet: nodeSet };
  }, [hovered, edges]);

  function edgePath(e: GEdge): string {
    const s = nodeMap.get(e.source);
    const t = nodeMap.get(e.target);
    if (!s || !t) return "";
    const x1 = s.x + R;
    const y1 = s.y;
    const x2 = t.x - R;
    const y2 = t.y;
    const cx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${cx} ${y1} ${cx} ${y2} ${x2} ${y2}`;
  }

  const hoveredNode = hovered ? nodeMap.get(hovered) : null;

  return (
    <div className="rounded-xl border border-border bg-canvas overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-fg">Response Graph</p>
          <p className="text-[11px] text-fg-muted mt-0.5">
            Engines → Brands → Citation domains. Hover any node to trace its connections.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-[10px] text-fg-subtle pt-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#3fb950] inline-block" />
            Target
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#6e7681] inline-block" />
            Competitor
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#e3b341] inline-block" />
            Domain
          </span>
        </div>
      </div>

      {/* Column labels */}
      <div className="grid grid-cols-3 px-4 pt-3 pb-0 text-[10px] font-semibold text-fg-subtle uppercase tracking-widest text-center">
        <span>Engines</span>
        <span>Brands</span>
        <span>Citation Domains</span>
      </div>

      {/* SVG canvas */}
      <div className="px-4 pb-2" onMouseLeave={() => setHovered(null)}>
        <svg
          viewBox={`0 0 ${SVG_W} ${svgH}`}
          width="100%"
          style={{ height: Math.min(svgH, 640), display: "block" }}
        >
          {/* Edges */}
          {edges.map((e) => {
            const active = connectedEdgeSet ? connectedEdgeSet.has(e.id) : true;
            return (
              <path
                key={e.id}
                d={edgePath(e)}
                fill="none"
                stroke={e.color}
                strokeWidth={e.strokeWidth}
                opacity={active ? 0.6 : 0.05}
                strokeLinecap="round"
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const active = connectedNodeSet ? connectedNodeSet.has(node.id) : true;
            const isHov = hovered === node.id;
            const color = nodeColor(node.type, node.id);
            return (
              <g
                key={node.id}
                transform={`translate(${node.x},${node.y})`}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHovered(node.id)}
              >
                <circle
                  r={isHov ? R + 5 : R}
                  fill={color + "18"}
                  stroke={color}
                  strokeWidth={isHov ? 2.5 : 1.5}
                  opacity={active ? 1 : 0.12}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={8.5}
                  fontWeight={600}
                  fill={color}
                  opacity={active ? 1 : 0.12}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {node.label}
                </text>
                <text
                  y={R + 11}
                  textAnchor="middle"
                  fontSize={8}
                  fill="#6e7681"
                  opacity={active ? 0.75 : 0.1}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  ×{node.count}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Hover detail bar */}
      <div
        className="px-5 py-2.5 border-t border-border bg-canvas-subtle min-h-[40px] flex items-center gap-3"
      >
        {hoveredNode ? (
          <>
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: nodeColor(hoveredNode.type, hoveredNode.id) }}
            />
            <span className="text-xs font-medium text-fg">{hoveredNode.fullLabel}</span>
            <span className="text-[11px] text-fg-muted">
              {hoveredNode.type === "engine" &&
                `${hoveredNode.count} response${hoveredNode.count !== 1 ? "s" : ""}`}
              {hoveredNode.type === "target" &&
                `${hoveredNode.count} mention${hoveredNode.count !== 1 ? "s" : ""} · target brand`}
              {hoveredNode.type === "competitor" &&
                `${hoveredNode.count} mention${hoveredNode.count !== 1 ? "s" : ""}`}
              {hoveredNode.type === "domain" &&
                `${hoveredNode.count} citation${hoveredNode.count !== 1 ? "s" : ""}`}
            </span>
            <span className="text-[11px] text-fg-subtle ml-auto">
              {connectedEdgeSet?.size ?? 0} connection{(connectedEdgeSet?.size ?? 0) !== 1 ? "s" : ""}
            </span>
          </>
        ) : (
          <span className="text-[11px] text-fg-subtle">Hover a node to inspect connections</span>
        )}
      </div>
    </div>
  );
}
