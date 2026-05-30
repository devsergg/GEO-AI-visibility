# CLAUDE.md — GEO Command Center

Build instructions and guardrails for Claude Code. Read this, the PRD (geo-command-center-prd.md), graph-schema.md, and data-contract.md before writing code.

---

## What this is

An AI-visibility tool for marketing teams. One run fans out across many *varied inputs* (intents, personas, framings) to three AI engines (ChatGPT, Grok, Perplexity) via Bright Data, writes results to a Cognee knowledge graph, and produces a visibility score, a centrality-ranked citation-gap list, a consideration-set view, source-traced sentiment, and grounded content recommendations. Hackathon MVP for the Bright Data hackathon.

---

## Golden rule: verify external integrations before building on them

The three external services — **Bright Data**, **Cognee**, **AI/ML API** — have shapes described from documentation, not confirmed from live calls. Before building any layer that depends on one:

1. Make ONE real call to the service.
2. Capture the raw response.
3. Correct data-contract.md / graph-schema.md to match reality.
4. Then build.

Do **not** build three layers against assumed shapes and test at the end. Validate each integration, then build the logic on top of it. The whole demo depends on Bright Data returning what we expect — validate it first, before anything else.

---

## Build sequence (do in order; this is also the cut order if time runs short)

1. **Bright Data pipeline** — async fan-out with a *single* prompt set first (not the varied set yet). Store raw responses + citations. **Validate the real response shape here.**
2. **Share-of-voice scoring** — mention detection + the transparent formula (see scoring spec / PRD 6.5). Expose the components.
3. **Citation-gap analysis** — collect competitor-cited URLs.
4. **Dashboard** — thin single page (Streamlit) wiring 1–3 together.

   → **Items 1–4 are the demonstrable core. Get them working live before anything below.** The impressive layers are worthless if the core pipeline doesn't run on stage.

5. **Input-variation engine** — structured generation along intent/persona/framing axes + semantic de-dup. Expand the fan-out to the varied set.
6. **Cognee layer** — cognify run findings per graph-schema.md; recall for centrality, consideration-set, sentiment-source queries. Add segment breakdown + centrality ranking to the dashboard.
7. **Sentiment with source tracing.**
8. **Recommendation engine** — grounded, centrality-prioritized recommendations + one draft artifact.
9. **Stretch only:** Google AI Overview via SERP API (a 4th engine).

---

## Do NOT build (scoped out — do not add these even if they seem impressive)

- **No autonomous publishing or CMS editing.** The product generates artifacts for human review only. Never wire up posting/publishing.
- **No 5th/6th engine** beyond the stretch goal. The `geo` group is ChatGPT, Grok, Perplexity — three. Do not claim or scaffold six.
- **No fabricated temporal drift.** Drift is a real capability (timestamped runs over real time) but is NOT demoable in a hackathon. Do not generate fake trend data or let input-variation breadth masquerade as drift. Keep them separate in code.
- **No outcome-learning / prompt-routing memory** in MVP. Roadmap only.
- **No auth, billing, or multi-tenancy.**
- **No agent framework** (LangChain/CrewAI). The pipeline is a plain async fan-out. LLM calls are direct, for variation generation, sentiment extraction, and recommendations only.

---

## Architecture

- **Backend:** Python + FastAPI. Collection = async fan-out across inputs × engines.
- **External:** Bright Data (Web Search API REST preferred over MCP for debuggability), Cognee (graph), AI/ML API (LLM inference — pin the model once validated).
- **Frontend:** Streamlit, single thin page. Do not over-build UI.
- **Storage:** Cognee graph for structural data; in-memory or JSON/SQLite for the run snapshot and demo fallback. No further DB work.
- Follow the data contracts in data-contract.md. Internal shapes are stable; external shapes get corrected after verification.

---

## Honesty constraints (these are product requirements, not suggestions)

- Graph rankings (centrality, consideration-set) gain reliability with data volume. A varied-input run makes them meaningful in one sitting, but the UI must not present thin-data rankings as settled strategic fact.
- Input variation = breadth of perspective *now*. Temporal drift = change *over time*. Never conflate them in code, UI, or output.
- The score formula must stay transparent and explainable — expose its components. No opaque scoring.
- Recommendations must be grounded in the run's actual data (lost segments, winning competitors, central sources), never generic marketing advice.

---

## Demo safety

- Pre-run a full varied-input run and cache it as a fallback before any live demo. Never rely solely on a live call.
- Pick a real brand in a category the engines have substantive opinions about (validated in advance), or the dashboard looks empty.
- Watch the Bright Data request budget: prompts × engines per run, against the 5,000 free monthly tier. Cache during development.

---

## When unsure

If an external API behaves differently than data-contract.md says, trust the real response and update the contract — flag the discrepancy rather than silently working around it. If a requested feature is on the "Do NOT build" list, say so rather than building it.
