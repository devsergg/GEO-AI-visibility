# GEO Command Center

**AI visibility intelligence for marketing teams.** Know whether — and how — your brand shows up when buyers query generative AI engines, then get prioritized, source-grounded actions to close the gaps.

Built for the [Bright Data hackathon](https://brightdata.com) — GTM Intelligence track.

![Python](https://img.shields.io/badge/python-3.12%2B-blue?logo=python)
![Next.js](https://img.shields.io/badge/dashboard-Next.js%2015-000000?logo=next.js)
![Bright Data](https://img.shields.io/badge/data-Bright%20Data-0085CA)
![GitHub](https://img.shields.io/badge/repo-devsergg%2FGEO--AI--visibility-181717?logo=github)
![License](https://img.shields.io/badge/license-unspecified-lightgrey)

---

## The problem

Buyers increasingly ask ChatGPT or Perplexity "what's the best CRM for a small team?" instead of running a Google search. Marketing teams have near-zero tooling to answer: *Are we mentioned? Who is recommended instead? What sources are these AI engines citing when they recommend our competitors? Does any of this hold across different buyer types or phrasings?*

Auditing this manually means querying several engines, several ways, noting the answers, finding the URLs — slow, unrepeatable, and one person's perspective.

---

## What it does

One run fans out a curated set of varied queries — across multiple **buyer intents, personas, and phrasings** — to AI engines in parallel, then surfaces:

| Output | What you get |
|---|---|
| **Visibility score (0–100)** | Share-of-voice across all responses; broken down by engine, intent, and persona |
| **Per-response mention table** | Which brands appeared, in what position, and whether as a recommendation |
| **Citation-gap list** | Competitor-cited source domains ranked by centrality — sources that move the most queries at once |
| **Sentiment breakdown** | Per-brand, per-engine polarity and positioning trait, traced to the citation domains that co-occur with each brand |
| **Grounded recommendations** | 3–5 specific actions referencing actual gap domains and competitor names from the run; includes a draft content artifact |
| **Score transparency** | Every number exposes its formula components — no opaque scoring |

---

## Architecture

```text
Next.js 15 frontend (web/)
  (brand, competitors, market, engines)
         |
         v  REST API calls
  FastAPI backend (api/main.py)
         |
         v
  Input-variation engine          geo/variation.py
  (gpt-4o-mini — optional)        intent × persona × framing axes
  semantic dedup (SequenceMatcher)
         |
         v list[Prompt]
  ┌──────────────────────────────────────────────────┐
  │  Async fan-out  (geo/pipeline.py)                │
  │  asyncio.gather over (prompt × engine) pairs     │
  └──────┬──────────┬──────────┬────────────────────┘
         |          |          |          |
         v          v          v          v
  chatgpt.py  google_serp.py  perplexity.py  gemini.py
  Datasets API  Web Unlocker   Datasets API   Datasets API
  (poll/snap)   (SERP+AI OVW)  (poll/snap)    (poll/snap)
         |          |          |          |
         └──────────┴──────────┴──────────┘
                    |
                    v dict (raw response)
             geo/parser.py
             mention detection · citation extraction
                    |
                    v list[ParsedResult]
         ┌──────────┴──────────┐
         |                     |
         v                     v
   geo/scorer.py         geo/cognee_store.py
   SOV formula           Cognee 1.1.1
   citation-gap          local knowledge graph
   centrality            consideration-set · absence
         |               centrality narrative
         |                     |
         v                     v
   geo/sentiment.py      geo/recommender.py
   (gpt-4o-mini)         (gpt-4o-mini)
   per-engine polarity   3–5 grounded recs
   + source tracing      + draft artifact
         |
         v
   cache/<run_id>.json   (every run is persisted)
         |
         v
   Next.js dashboard (localhost:3000)
```

### Engine status

| Engine | Status | Via |
|---|---|---|
| ChatGPT | **Working** (validated 2026-05-28) | Bright Data Datasets API — dataset `gd_m7aof0k82r803d5bjm` |
| Google AI Overview | **Working** (validated 2026-05-28) | Bright Data Web Unlocker SERP — `ai_overview.texts` field |
| Perplexity | Implemented — **dataset ID needed** | Bright Data Datasets API — set `PERPLEXITY_DATASET_ID` in `.env` |
| Gemini | Implemented — **dataset ID needed** | Bright Data Datasets API — set `GEMINI_DATASET_ID` in `.env` (dataset `gd_mbz66arm2mf9cu856y`) |
| Grok | Not available | Blocked by X as of validation date |

---

## Visibility score — formula

The score is fully transparent. Every component is surfaced in the dashboard's score metrics row.

```
mention_rate   = responses_mentioning_target / total_responded
position_score = 1 − ((avg_position − 1) / max_position)   [0..1; higher = earlier mention]
visibility_score = (mention_rate × 0.7 + position_score × 0.3) × 100
```

Weights (0.7 / 0.3) are exposed in the `components` dict returned by `scorer.score()`. The formula is explicit by design — no black-box scoring.

---

## Project structure

```text
GEO-AI-visibility/
├── geo/                        # Core Python package
│   ├── config.py               # Env loading; API tokens; dataset IDs; poll config
│   ├── models.py               # RunConfig, Prompt, ParsedResult, ScoreResult,
│   │                           #   CitationGapEntry, BrandSentiment, Recommendation, DraftArtifact
│   ├── pipeline.py             # Async fan-out orchestrator; cache read/write
│   ├── parser.py               # Mention detection (regex + context window); citation extraction
│   ├── scorer.py               # SOV formula; citation-gap centrality ranking
│   ├── variation.py            # LLM-driven prompt generation (gpt-4o-mini) + semantic dedup
│   ├── sentiment.py            # Per-brand, per-engine polarity + source tracing (gpt-4o-mini)
│   ├── recommender.py          # Grounded recommendations + draft artifact (gpt-4o-mini)
│   ├── company_research.py     # Auto-detect competitors + market category for a brand
│   ├── cognee_store.py         # Cognee ingest/recall for graph insights
│   └── engines/
│       ├── base.py             # BaseEngine ABC: query / extract_text / extract_citations
│       ├── chatgpt.py          # Bright Data Datasets API — async submit → poll → snapshot
│       ├── google_serp.py      # Bright Data Web Unlocker — ai_overview extraction
│       ├── perplexity.py       # Bright Data Datasets API — same pattern; needs PERPLEXITY_DATASET_ID
│       └── gemini.py           # Bright Data Datasets API — same pattern; needs GEMINI_DATASET_ID
├── api/
│   └── main.py                 # FastAPI backend — REST wrapper consumed by the Next.js frontend
├── web/                        # Next.js 15 App Router frontend (the dashboard)
│   ├── src/app/page.tsx        # Single-page app shell; all section routing
│   └── src/components/
│       ├── NavSidebar.tsx      # Left nav: sections, recent runs, backend status indicator
│       ├── MetricsRow.tsx      # Key metrics at a glance after a run
│       ├── EngineChart.tsx     # Per-engine score bar chart
│       ├── MentionTable.tsx    # Per-response brand mention table
│       ├── CitationGap.tsx     # Citation-gap centrality list
│       ├── GraphInsightsSection.tsx  # 5 Cognee graph insight accordion cards
│       ├── RecommendationsSection.tsx # Grounded recs + draft artifact
│       └── OvertimeView.tsx    # Line chart of score history filtered to current brand
├── scripts/
│   ├── validate_brightdata.py  # One-shot validation script — makes one real call per scraper
│   ├── validate_cognee.py      # Cognee integration validation
│   ├── validate_chatgpt.json   # Captured raw ChatGPT response (verified shape)
│   └── validate_perplexity.json
├── cache/                      # Auto-created; JSON run snapshots for offline replay
├── data-contract.md            # Internal + external data shapes (external shapes are verified)
├── graph-schema.md             # Cognee knowledge graph schema
├── geo-command-center-prd.md   # Full product requirements document
├── requirements.txt            # Python dependencies
├── .env.example                # Environment variable template
└── CLAUDE.md                   # Build instructions and guardrails
```

---

## Prerequisites

- **Python 3.12+**
- **Node.js 18+** (for the Next.js frontend)
- A [Bright Data](https://brightdata.com) account:
  - `BRIGHTDATA_API_TOKEN` — required; authorizes all engine calls
  - `BRIGHTDATA_ZONE` — defaults to `mcp_unlocker`; used for the Google SERP engine
- **`OPENAI_API_KEY`** — required for input-variation, sentiment analysis, and recommendations (all use `gpt-4o-mini`); without it the pipeline falls back to a fixed 5-prompt set and skips sentiment/recommendations
- **`PERPLEXITY_DATASET_ID`** — find yours in the Bright Data dashboard at `/cp/scrapers/gd_xxx`; required only if you enable the Perplexity engine
- **`GEMINI_DATASET_ID`** — dataset `gd_mbz66arm2mf9cu856y`; required only if you enable the Gemini engine

---

## Quickstart

```bash
# 1. Clone
git clone https://github.com/devsergg/GEO-AI-visibility.git
cd GEO-AI-visibility

# 2. Python — create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Edit .env — fill in BRIGHTDATA_API_TOKEN and OPENAI_API_KEY at minimum

# 5. (Optional) Validate Bright Data connections before running
python scripts/validate_brightdata.py

# 6. Start the FastAPI backend
uvicorn api.main:app --reload --port 8000

# — In a second terminal —

# 7. Install and start the Next.js frontend
cd web
npm install
npm run dev
# Opens at http://localhost:3000
```

---

## Using the dashboard

The dashboard is a Next.js 15 single-page app at `http://localhost:3000`. Navigation lives in a persistent left sidebar.

**Left sidebar**

- Section links: Home, Insights, Overtime, Recommendations, Responses
- Recent Runs list: click any entry to load it; hover to reveal the delete button
- Backend status indicator at the bottom (green = FastAPI reachable, red = offline)

**Home — run configuration and results**

1. Enter your target brand in the prominent input field and press Enter or click the play button.
2. Click "Find competitors and niche automatically" to have the backend research and pre-fill the competitors and market category fields.
3. Expand "Configure competitors, market & engines" to adjust the competitors list, market category, active engines (ChatGPT, Google AI Overview, Perplexity, Gemini), variation toggle, and prompts-per-engine slider (5–20).
4. The estimated Bright Data request count is shown before you run.
5. After the run completes, the brand header shows the visibility score (color-coded 0–100), active engines, and run ID. Insights and Recommendations generate automatically in parallel.
6. Use "New Analysis" to run a different brand, or "Schedule" to set up a recurring analysis interval (stored in localStorage).

**Responses**

Per-response mention table grouped by engine. Shows which brands appeared, in what position, and raw citations. Failed responses are listed in a collapsible warning. Raw response text is available in a second collapsible.

**Insights**

Five accordion cards powered by the Cognee knowledge graph recall pass:

| Card | What it tells you |
|---|---|
| Consideration Set | Which brands AI groups together and whether you're in the cluster |
| When You're Absent | Who won the response when you weren't mentioned, and via which sources |
| Source Centrality | Cited sources appearing most across competitor-recommending responses |
| Sentiment & Sources | Engines or sources associated with more critical coverage of your brand |
| Segment Gaps | Which buyer intents and personas show you mentioned least |

Also includes per-engine sentiment polarity (positive / neutral / negative) with a "Run Sentiment Analysis" trigger.

**Overtime**

Line chart of visibility score history filtered to the current brand. Shows total runs, average score, and latest score. Click any point on the chart to load that run. Requires at least two runs for the same brand to draw a trend line.

**Recommendations**

3–5 grounded recommendations citing specific domains and competitor names from the actual run, plus a draft content artifact. Generated automatically after each run; can be re-triggered manually.

> **Budget note:** each (prompt × engine) is one Bright Data request. A 10-prompt × 2-engine run = 20 requests against your 5,000/month free tier. Cache aggressively during development.

---

## Module reference

| Module | Role |
|---|---|
| `geo/config.py` | Reads env vars via `python-dotenv`; hardcodes `LLM_MODEL = "gpt-4o-mini"` and `CHATGPT_DATASET_ID`; exposes poll timing constants |
| `geo/models.py` | Pure Python dataclasses: `RunConfig`, `Prompt`, `ParsedResult`, `ScoreResult`, `CitationGapEntry`, `BrandSentiment`, `Recommendation`, `DraftArtifact` |
| `geo/pipeline.py` | `run(cfg)` → `list[ParsedResult]`; `run_with_insights()` also ingests to Cognee; `load_cached()` / `list_cached_runs()` for offline replay |
| `geo/parser.py` | Regex + context-window mention detection; citation extraction from engine-specific fields |
| `geo/scorer.py` | `score()` → `ScoreResult` with transparent components dict; `citation_gap()` → centrality-ranked `CitationGapEntry` list |
| `geo/variation.py` | `generate()` → `list[Prompt]` via one `gpt-4o-mini` call; `_dedup()` drops near-paraphrases via `difflib.SequenceMatcher`; `default_variation()` provides sensible axes |
| `geo/sentiment.py` | `analyze()` → `list[BrandSentiment]`; one `gpt-4o-mini` call per engine group, all in parallel via `asyncio.gather` |
| `geo/recommender.py` | `recommend()` → `(list[Recommendation], DraftArtifact)`; prompt is assembled from citation-gap data, sentiment, score components, and optional Cognee segment narrative |
| `geo/cognee_store.py` | `run_all_insights()` ingests parsed results and recalls consideration-set, absence explanation, centrality narrative, sentiment-source narrative, and segment gaps. Includes an LLM rewrite pass for clean narrative output |
| `geo/company_research.py` | Looks up a brand name to return a suggested market category and competitor list |
| `geo/engines/chatgpt.py` | Submit → poll `/datasets/v3/progress` → download snapshot; reads `answer_text` and `search_sources` + `references` |
| `geo/engines/google_serp.py` | Web Unlocker POST → parse `ai_overview.texts[].snippet` and `ai_overview.texts[].links` |
| `geo/engines/perplexity.py` | Same submit/poll/snapshot pattern; reads `citations` and `sources` arrays |
| `geo/engines/gemini.py` | Same submit/poll/snapshot pattern; reads from Gemini-specific response fields |
| `api/main.py` | FastAPI app with CORS middleware; exposes `/api/run`, `/api/load/{run_id}`, `/api/runs`, `/api/delete/{run_id}`, `/api/insights/{run_id}`, `/api/sentiment/{run_id}`, `/api/recommendations/{run_id}`, `/api/research`, `/api/health` |

---

## Environment variables

All variables are read from `.env` via `python-dotenv`. See `.env.example` for the full template.

| Variable | Required | Default | Description |
|---|---|---|---|
| `BRIGHTDATA_API_TOKEN` | Yes | — | Authorizes all Bright Data API calls |
| `BRIGHTDATA_ZONE` | No | `mcp_unlocker` | Zone name for the Web Unlocker (Google SERP engine) |
| `PERPLEXITY_DATASET_ID` | Only for Perplexity engine | — | Scraper dataset ID from Bright Data dashboard |
| `GEMINI_DATASET_ID` | Only for Gemini engine | — | Dataset `gd_mbz66arm2mf9cu856y`; from Bright Data dashboard |
| `OPENAI_API_KEY` | No* | — | Required for variation, sentiment, and recommendations; falls back to fixed prompts without it |
| `ANTHROPIC_API_KEY` | No | — | Optional; not used in current pipeline |
| `AIML_API_KEY` | No | — | Optional alternative LLM provider |
| `LLM_API_KEY` | No | — | Same value as `OPENAI_API_KEY`; Cognee reads this key separately |
| `ENABLE_BACKEND_ACCESS_CONTROL` | No | `false` | Cognee setting; leave false for local use |

*Without `OPENAI_API_KEY` the pipeline runs with a fixed 5-prompt set and disables sentiment analysis and recommendations.

---

## Validating integrations

Before a live run or after changing credentials:

```bash
python scripts/validate_brightdata.py
```

Makes one real call per configured scraper, prints HTTP status and first 2 KB of the response, and writes the full raw JSON to `scripts/validate_<engine>.json`. Use those files to confirm response shapes before running the full pipeline.

---

## Build sequence and status

Steps are ordered by priority — this is also the cut order if time runs short.

| Step | What | Status |
|---|---|---|
| 1 | **Bright Data pipeline** — async fan-out, raw response capture, cache | Done — ChatGPT and Google AI Overview validated; Perplexity and Gemini need dataset IDs |
| 2 | **Share-of-voice scoring** — transparent formula, component exposure | Done |
| 3 | **Citation-gap analysis** — competitor-cited sources, centrality ranking | Done |
| 4 | **Next.js dashboard** — wires steps 1–3 together | Done |
| 5 | **Input-variation engine** — intent × persona × framing axes, semantic dedup | Done |
| 6 | **Cognee knowledge graph layer** — ingest, consideration-set, segment gaps | Done |
| 7 | **Sentiment with source tracing** | Done |
| 8 | **Recommendation engine** — grounded recs + draft artifact | Done |
| 9 | **Google AI Overview as first-class 4th engine** (stretch) | Engine built and validated; integrated |

---

## Honesty constraints

These are product requirements, not suggestions. They are encoded in the scoring formulas, the dashboard copy, and the LLM system prompts.

**Input variation is not temporal drift.** A varied-input run answers "how visible am I across the different ways buyers ask, right now." Temporal drift — how visibility changes over time — requires runs separated by real elapsed time. These are kept separate in code and in the dashboard output. The Overtime view shows score history across real cached runs; it does not fabricate trend data.

**Thin-data rankings are flagged, not asserted.** Graph centrality and consideration-set rankings gain reliability with data volume. A single run produces signals, not settled strategic fact. The UI does not present them as such.

**The score formula is always visible.** Every dashboard metric exposes its formula components. There is no opaque number.

**Recommendations are grounded in the run's data.** The recommender's system prompt explicitly prohibits generic marketing advice and requires citing specific domain names, competitor names, or engine names from the actual run.

---

## Scoped out (not in MVP)

- No autonomous publishing or CMS editing — artifacts are for human review only
- No Grok engine — blocked by X as of validation date
- No fabricated temporal drift — trend data requires real elapsed time between runs
- No agent framework (LangChain, CrewAI) — the pipeline is a plain `asyncio.gather` fan-out
- No auth, billing, or multi-tenancy

---

## Demo safety checklist

- [ ] Pre-run a full varied-input run and verify the cache file exists before going live
- [ ] Choose a brand in a category the engines have substantive opinions about — validate a test query manually first
- [ ] Count `max_prompts × len(engines)` and confirm it fits your remaining Bright Data free-tier budget
- [ ] Confirm the FastAPI backend is running (`uvicorn api.main:app --reload --port 8000`) before opening the Next.js frontend

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, asyncio, aiohttp, FastAPI |
| Dashboard | Next.js 15 (App Router), React 19, Tailwind CSS, Recharts |
| AI engine access | Bright Data (Datasets API + Web Unlocker) |
| Input variation / sentiment / recommendations | OpenAI `gpt-4o-mini` via `openai` SDK |
| Knowledge graph | Cognee 1.1.1 (local, no cloud subscription) |
| Data shapes | Python dataclasses + Pydantic v2 |

---

## License

No LICENSE file is present in the repository. License terms are unspecified.
