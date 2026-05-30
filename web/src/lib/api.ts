import type {
  RunRequest,
  RunData,
  CachedRunMeta,
  BrandSentiment,
  RecommendationsResponse,
  InsightsResponse,
  ResearchResult,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = 180_000
): Promise<T> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`API ${res.status}: ${text}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(tid);
  }
}

export async function researchCompany(brand: string): Promise<ResearchResult> {
  return request<ResearchResult>("/api/research", {
    method: "POST",
    body: JSON.stringify({ brand }),
  });
}

export async function runAnalysis(req: RunRequest): Promise<RunData> {
  return request<RunData>(
    "/api/run",
    { method: "POST", body: JSON.stringify(req) },
    300_000
  );
}

export async function listRuns(): Promise<CachedRunMeta[]> {
  return request<CachedRunMeta[]>("/api/runs");
}

export async function loadRun(runId: string): Promise<RunData> {
  return request<RunData>(`/api/runs/${runId}`);
}

export async function runSentiment(runId: string): Promise<BrandSentiment[]> {
  return request<BrandSentiment[]>(
    `/api/runs/${runId}/sentiment`,
    { method: "POST" },
    60_000
  );
}

export async function runRecommendations(
  runId: string,
  sentiments?: BrandSentiment[]
): Promise<RecommendationsResponse> {
  return request<RecommendationsResponse>(
    `/api/runs/${runId}/recommendations`,
    {
      method: "POST",
      body: JSON.stringify({ sentiments: sentiments ?? null }),
    },
    60_000
  );
}

export async function deleteRun(runId: string): Promise<void> {
  await request<{ deleted: string }>(`/api/runs/${runId}`, { method: "DELETE" });
}

export async function runInsights(runId: string): Promise<InsightsResponse> {
  return request<InsightsResponse>(
    `/api/runs/${runId}/insights`,
    { method: "POST" },
    360_000
  );
}
