export interface RunRequest {
  brand: string;
  competitors: string[];
  market: string;
  engines: string[];
  use_variation: boolean;
  max_prompts: number;
}

export interface Mention {
  brand: string;
  position: number;
  is_recommendation: boolean;
}

export interface Citation {
  domain: string;
  url: string;
}

export interface ParsedResult {
  run_id: string;
  prompt_id: string;
  prompt_text: string;
  engine: string;
  raw_text: string;
  timestamp: string;
  mentions: Mention[];
  citations: Citation[];
  responded: boolean;
  error: string | null;
}

export interface ScoreComponents {
  total_responses: number;
  mention_count: number;
  mention_rate: number;
  avg_position: number | null;
  position_score: number;
  weight_mention: number;
  weight_position: number;
}

export interface ScoreResult {
  run_id: string;
  target_brand: string;
  visibility_score: number;
  by_intent: Record<string, number>;
  by_persona: Record<string, number>;
  by_engine: Record<string, number>;
  components: ScoreComponents;
  mention_rate: number;
  avg_position: number | null;
}

export interface CitationGapEntry {
  domain: string;
  urls: string[];
  competitor_count: number;
  prompt_count: number;
  engine_count: number;
  centrality_score: number;
  reaching_competitors: string[];
  reaching_intents: string[];
  reaching_engines: string[];
}

export interface RunConfig {
  target_brand: string;
  competitors: string[];
  market: string;
  engines: string[];
  run_id?: string;
}

export interface RunData {
  run_id: string;
  config: RunConfig;
  score: ScoreResult;
  gap_list: CitationGapEntry[];
  results: ParsedResult[];
  responded_count: number;
  failed_count: number;
}

export interface BrandSentiment {
  brand: string;
  polarity: "positive" | "neutral" | "negative" | "mixed";
  trait: string;
  source_domains: string[];
  engine: string;
}

export interface Recommendation {
  title: string;
  rationale: string;
  action: string;
  priority: "high" | "medium" | "low";
  target_source: string;
}

export interface DraftArtifact {
  artifact_type: string;
  title: string;
  content: string;
}

export interface RecommendationsResponse {
  recommendations: Recommendation[];
  artifact: DraftArtifact | null;
}

export interface InsightsResponse {
  consideration_set: string;
  absence_explanation: string;
  centrality_narrative: string;
  sentiment_sources: string;
  segment_gaps: string;
}

export interface CachedRunMeta {
  run_id: string;
  target_brand: string;
  market: string;
  engines: string[];
  result_count: number;
}

export interface ResearchResult {
  market: string;
  competitors: string[];
}
