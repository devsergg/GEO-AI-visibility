from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class VariationConfig:
    intents: list[str]
    personas: list[str]
    framings: list[str]
    max_prompts: int = 20
    dedup: bool = True


@dataclass
class RunConfig:
    target_brand: str
    competitors: list[str]
    market: str
    engines: list[str] = field(default_factory=lambda: ["chatgpt", "google_serp"])
    variation: Optional[VariationConfig] = None
    run_id: str = ""

    def __post_init__(self):
        if not self.run_id:
            import uuid, datetime
            ts = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%S")
            self.run_id = f"run_{ts}_{uuid.uuid4().hex[:6]}"


@dataclass
class Prompt:
    id: str
    text: str
    intent: str
    persona: str
    framing: str


@dataclass
class Mention:
    brand: str
    position: int          # 1 = first mention
    is_recommendation: bool


@dataclass
class Citation:
    domain: str
    url: str


@dataclass
class ParsedResult:
    run_id: str
    prompt_id: str
    prompt_text: str
    engine: str
    raw_text: str
    timestamp: str
    mentions: list[Mention]
    citations: list[Citation]
    responded: bool = True
    error: Optional[str] = None


@dataclass
class ScoreResult:
    run_id: str
    target_brand: str
    visibility_score: float          # 0–100
    by_intent: dict[str, float]
    by_persona: dict[str, float]
    by_engine: dict[str, float]
    components: dict                  # raw inputs for transparency
    mention_rate: float               # fraction of responses mentioning brand
    avg_position: Optional[float]     # avg rank when mentioned


@dataclass
class BrandSentiment:
    brand: str
    polarity: str          # "positive" | "neutral" | "negative" | "mixed"
    trait: str             # one concise phrase describing how the brand is characterized
    source_domains: list[str]  # citation domains co-occurring with this brand
    engine: str            # which engine produced this sentiment


@dataclass
class Recommendation:
    title: str           # short action name (≤8 words)
    rationale: str       # why, grounded in run data
    action: str          # specific next step
    priority: str        # "high" | "medium" | "low"
    target_source: str   # domain to focus on, or empty string


@dataclass
class DraftArtifact:
    artifact_type: str   # "blog_post_outline" | "pr_pitch" | "content_brief" | "faq_page"
    title: str
    content: str         # the actual draft text


@dataclass
class CitationGapEntry:
    domain: str
    urls: list[str]
    competitor_count: int             # distinct competitors citing this
    prompt_count: int                 # distinct prompts where seen
    engine_count: int                 # distinct engines
    centrality_score: float           # composite: competitor × prompt × engine
    reaching_competitors: list[str]
    reaching_intents: list[str]
    reaching_engines: list[str]
