# GEO Command Center — Data Contracts

**Version:** 0.1
**Companion to:** PRD v0.2, graph-schema.md
**Status:** Draft. The internal contracts (RunConfig, Prompt, ParsedResult, scoring I/O, recommendation I/O) are ours and stable — build against them. The **external** shapes (BrightDataResponse, Cognee calls, AI/ML API calls) are *expected* shapes from documentation, NOT verified live responses. Make one real call to each service, capture the raw output, and correct these before building the pipeline on them.

---

## 1. Why this exists

These are the object shapes that move through the pipeline. Pinning them down lets every function have a fixed target. The flow:

```
RunConfig
  → [input-variation engine] → list[Prompt]
  → [Bright Data fan-out]     → list[BrightDataResponse]  (EXTERNAL — verify)
  → [parser]                  → list[ParsedResult]
  → [scorer]                  → ScoreResult
  → [Cognee ingest]           → graph (see graph-schema.md)
  → [graph queries]           → CentralityResult, ConsiderationSet, SentimentResult
  → [recommender]             → list[Recommendation] + DraftArtifact
  → [dashboard]
```

---

## 2. Internal contracts (stable — build against these)

### RunConfig — user input expanded
```
RunConfig:
  target_brand: str
  competitors: list[str]
  market: str                 # e.g. "local 3D printing services in the Bay Area"
  engines: list[str]          # default ["chatgpt","grok","perplexity"]
  variation: VariationConfig
```

### VariationConfig — controls the input-variation engine
```
VariationConfig:
  intents: list[str]          # distinct buyer intents; deliberately curated
  personas: list[str]         # distinct buyer types
  framings: list[str]         # phrasings ("best","most reliable","affordable",...)
  max_prompts: int            # hard cap to control request budget
  dedup: bool = true          # semantically de-dup near-identical prompts
```

### Prompt — one varied input
```
Prompt:
  id: str
  text: str
  intent: str
  persona: str
  framing: str
```
> Quality rule (PRD 6.2): prompts must be genuinely distinct angles, not paraphrases. De-dup before running. Fewer distinct > many near-identical.

### ParsedResult — normalized engine answer (parser output)
```
ParsedResult:
  run_id: str
  prompt_id: str
  engine: str
  raw_text: str
  timestamp: str              # ISO 8601
  mentions: list[Mention]
  citations: list[Citation]
  responded: bool             # false if engine failed/empty — pipeline continues

Mention:
  brand: str
  position: int               # order of appearance; 1 = first
  is_recommendation: bool

Citation:
  domain: str                 # normalized for aggregation
  url: str
```

### ScoreResult — scorer output
```
ScoreResult:
  visibility_score: float     # 0-100, target brand
  by_intent: dict[str,float]  # segment breakdown
  by_persona: dict[str,float]
  by_engine: dict[str,float]
  components: dict             # exposed inputs so the score is explainable (PRD 6.5)
```

### Graph-query outputs
```
CentralityResult:
  ranked_sources: list[{domain, centrality_score, reaching_competitors:list[str],
                        reaching_intents:list[str], reaching_engines:list[str]}]

ConsiderationSet:
  dominant_cluster: list[str]      # brands the engines group together
  target_in_cluster: bool
  defining_sources: list[str]

SentimentResult:
  associations: list[{brand, polarity, trait, confidence,
                      source_domains: list[str]}]   # source-traced (graph-schema 4.3)
```

### Recommendation + DraftArtifact — recommender output
```
Recommendation:
  gap: str                    # which intent/persona/prompt was lost
  winning_competitors: list[str]
  target_sources: list[str]   # central sources to pursue (from CentralityResult)
  angle: str                  # topic/angle to cover
  rationale: str              # grounded in the data above

DraftArtifact:
  title: str
  type: str                   # "blog_outline" | "short_post"
  body: str                   # structured for AI extractability (PRD 6.8)
  recommendation_ref: Recommendation
```

---

## 3. External contracts (VERIFIED — updated from live validation calls 2026-05-28)

### ChatGPT scraper — Bright Data datasets API
**Endpoint:** `POST https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_m7aof0k82r803d5bjm&notify=false&include_errors=true`
**Auth:** `Authorization: Bearer {BRIGHTDATA_API_TOKEN}`

**Request body:**
```json
{
  "input": [
    {
      "url": "https://chatgpt.com/",
      "prompt": "...",
      "country": "US",
      "web_search": true,
      "additional_prompt": ""
    }
  ]
}
```

**Async flow:** Returns `{"snapshot_id": "sd_..."}` → poll `GET /datasets/v3/progress/{snapshot_id}` until `status=ready` → download `GET /datasets/v3/snapshot/{snapshot_id}?format=json` (returns JSON array).

**Verified response fields per record:**
```
url: str                     # echoed, includes query params
prompt: str                  # echoed
answer_text: str             # plain text AI response ← USE THIS for mention detection
answer_text_markdown: str    # markdown version
answer_html: str             # full page HTML (2–3 MB) — skip in parser
answer_section_html: str     # just the answer div
citations: null | list       # null unless web_search triggered by query type
search_sources: list         # empty when citations null
references: list             # empty when citations null
web_search_triggered: bool   # false for stable factual queries (e.g. "best CRM")
model: str                   # e.g. "gpt-5-5"
recommendations: list        # product card recs (shopping queries)
shopping: list
is_map: bool
prompt_sent_at: str          # ISO 8601
timestamp: str               # ISO 8601
input: dict                  # original input object
```

**Note:** `web_search` flag enables but does not guarantee web search — ChatGPT decides based on query type. Stable factual queries answer from training data with `citations: null`. Time-sensitive or location-specific queries will trigger web search.

---

### Google AI Overview — Bright Data Web Unlocker SERP
**Endpoint:** `POST https://api.brightdata.com/request`
**Auth:** `Authorization: Bearer {BRIGHTDATA_API_TOKEN}`

**Request body:**
```json
{
  "zone": "mcp_unlocker",
  "url": "https://www.google.com/search?q={encoded_query}&brd_json=1",
  "format": "json"
}
```

**Response:** `{"status_code": 200, "headers": {...}, "body": "<JSON string>"}`
Parse `body` as JSON. Relevant fields:
```
general.query: str
general.results_cnt: int
organic: list[{title, url, description, ...}]
ai_overview.texts: list[{
  type: str,             # "paragraph"
  snippet: str,          # AI-generated text with brand mentions ← USE THIS
  links: list[{link}]    # citation URLs ← USE FOR citation-gap
}]
people_also_ask: list[{question, answer, ...}]
```

**Note:** `ai_overview` is the Google AI Overview (AI-generated answer at top of SERP). Always contains citations via `links`. Best engine for citation-gap analysis alongside Perplexity.

---

### Perplexity scraper — Bright Data datasets API
**VERIFIED 2026-05-29 via live call (snapshot sd_mpros9qto8ajq8qln)**
**Dataset ID:** `gd_m7dhdot1vw9a7gc1n`
**Endpoint:** `POST https://api.brightdata.com/datasets/v3/trigger?dataset_id=gd_m7dhdot1vw9a7gc1n&notify=false&include_errors=true`
**Note:** Uses `/trigger` (not `/scrape` like ChatGPT). Same async flow otherwise.
**Auth:** `Authorization: Bearer {BRIGHTDATA_API_TOKEN}`

**Request body:**
```json
{
  "input": [
    {
      "url": "https://www.perplexity.ai",
      "prompt": "...",
      "country": "US"
    }
  ]
}
```

**Async flow:** Returns `{"snapshot_id": "sd_..."}` → poll `GET /datasets/v3/progress/{snapshot_id}` until `status=ready` (~29s avg) → download `GET /datasets/v3/snapshot/{snapshot_id}?format=json`.

**Verified response fields per record:**
```
url: str                     # perplexity.ai/search/{uuid}
prompt: str                  # echoed
answer_text: str             # plain text AI response ← USE THIS for mention detection
answer_text_markdown: str    # markdown version
answer_html: str             # full page HTML (~450 KB) — skip in parser
answer_section_html: str     # just the answer div
citations: list[{            # always present; Perplexity always cites
  url: str,
  title: str,
  domain: str,               # full URL form e.g. "https://en.wikipedia.org/"
  position: str              # string "1", "2", ...
}]
sources: list[{              # parallel list with same URLs, richer metadata
  title: str,
  url: str,
  description: str | null,
  position: int
}]
related_prompts: list[str]   # follow-up suggestions
web_search_query: list[str]  # query Perplexity issued
is_shopping_data: bool
shopping_data: null | list
exported_markdown: null | str
response_raw: str            # raw SSE stream — skip in parser
source_html: str             # full sources page HTML (~1 MB) — skip in parser
timestamp: str               # ISO 8601
input: dict                  # original input echoed back
```

**Note:** Perplexity always returns citations (unlike ChatGPT). Use `citations` list in parser; `sources` has identical URLs with richer metadata if needed.

---

### Cognee — ingestion and recall
Not yet validated. Confirm `cognify`/`recall` round-trip with typed objects before wiring real data.

### LLM calls (variation generation, sentiment, recommendations)
Using Anthropic API (`ANTHROPIC_API_KEY`) or AI/ML API if available. Pin model once validated.

---

## 4. Cross-cutting rules

- **Graceful degradation:** a failed engine sets `responded=false` and the run continues; the dashboard shows coverage.
- **Provenance:** every inferred fact (mention, recommendation, sentiment) retains a link to its `ParsedResult`/`Response` so the graph's source-tracing queries work.
- **Request budget:** prompts × engines = Bright Data requests. `max_prompts` caps this. Budget against the 5,000 free tier across dev + demo; cache during dev.
- **Drift separation:** nothing in a single run's contracts represents temporal drift. Drift is a cross-`Run` comparison over real time only.
