# GEO Command Center — Product Requirements Document

**Version:** 0.2 (Hackathon MVP — adds input-variation engine, Cognee memory layer, AI/ML API)
**Context:** Bright Data hackathon — GTM Intelligence track
**Status:** Draft for build
**Last updated:** May 2026

---

## 1. Summary

GEO Command Center is an AI-visibility intelligence tool for marketing teams. It tells a brand whether — and how — it shows up when buyers ask generative AI engines (ChatGPT, Grok, Perplexity) for recommendations, then produces grounded, actionable content recommendations to close the gaps it finds.

A single run does not ask one question once. It fans out across a curated set of **varied inputs** — multiple buyer intents, personas, and framings — querying three AI engines for each, and feeds every result into a **persistent knowledge graph** (Cognee). This populates a rich, multi-angle picture of the brand's AI visibility in one sitting, and accumulates structural insight (source centrality, consideration-set membership, sentiment-to-source links) that no single query can reveal.

The product turns a manual, unrepeatable audit into a repeatable, multi-perspective intelligence run that returns a visibility score, a citation-gap analysis, sentiment with traceable sources, and targeted content recommendations — and gets sharper the more it is run.

---

## 2. Problem

Buyers increasingly ask generative AI engines for product and vendor recommendations instead of, or alongside, traditional search. Marketing teams have established tooling for Google SEO but near-zero visibility into how AI engines represent their brand. They cannot answer basic questions: When a buyer asks an AI engine for the best option in our category, are we mentioned? Are competitors mentioned instead? What sources is the AI citing when it recommends them? Is the AI associating our brand with anything negative? And critically — does any of this hold across different ways of asking, or different buyer segments?

Answering this manually is slow and not repeatable: the engines block automated access, their output formats shift, and a human auditing several engines across several prompts and phrasings spends hours and produces a one-off snapshot that ignores how much the answer depends on how the question was asked.

---

## 3. Goals and non-goals

### 3.1 Goals (MVP)

- Measure a brand's share of voice across ChatGPT, Grok, and Perplexity, across a **varied set of inputs** (multiple intents, personas, framings) rather than a single prompt set.
- Identify the source URLs AI engines cite when recommending competitors but not the target brand (citation-gap analysis).
- Build a persistent knowledge graph of brands, sources, prompts, engines, and sentiment so that **cross-input structural insight** — source centrality, consideration-set clustering, sentiment-to-source tracing — becomes queryable.
- Produce a sentiment read in which each association traces back to the source that fed it.
- Generate grounded, actionable content recommendations and at least one ready-to-review draft artifact, targeted at the specific gaps found and prioritized using graph centrality.
- Present all of the above in a single dashboard view, driven by a live run.

### 3.2 Non-goals (explicitly out of scope for MVP)

- **Autonomous publishing or live editing** of any CMS, site, or social account. The product generates artifacts for human review; it does not ship them.
- **Demoable time-series drift.** The knowledge graph timestamps every run and *is architecturally capable* of temporal-drift queries (change in the same input over time). But drift requires runs separated by real time (days/weeks), which a hackathon does not provide. This is a supported, real capability that we will not demo as a populated trend — and we will not let input-variation breadth be mistaken for it. See Section 7.3.
- **Proving causal impact** on AI rankings within the demo. The product recommends; it does not claim to verify that a recommendation moved a ranking.
- **Six-engine coverage.** Three engines via the Bright Data `geo` group, with Google AI Overview as a stretch goal via the SERP API. See Section 8.
- **Outcome-learning / prompt-routing memory** (Cognee can do this, but it only pays off after many runs with user feedback and won't demo convincingly). Roadmap, not MVP.
- Authentication, billing, multi-tenancy, and production monitoring.

---

## 4. Target users

- **Primary:** Marketing managers and SEO/content leads at small-to-mid companies and agencies who own brand visibility and need to know where they stand in AI-driven discovery.
- **Secondary:** CMOs and agency leads who want a defensible, repeatable, multi-segment read on AI visibility to bring to clients or leadership.

---

## 5. User stories

- As a marketing lead, I enter my brand, competitors, and market, and get a single score for how visible I am in AI recommendations — across many ways a buyer might ask, not just one.
- As a content strategist, I see which buyer intents and which personas my brand is invisible to, not just an average.
- As an SEO lead, I get a list of competitor-cited source domains ranked by how *structurally central* they are across all the angles tested — so I know which targets move the most queries, not just which appeared once.
- As a strategist, I see which competitors the engines group me with (or exclude me from) — my category's AI-perceived consideration set.
- As a PR lead, I see negative associations *and the specific sources likely feeding them*, not just the perception in the abstract.
- As a content strategist, I get a specific recommendation and a ready draft tied to a real, prioritized gap.

---

## 6. Functional requirements

### 6.1 Input

The user provides: target brand; competitor list; market/category descriptor. The system then expands this into a **varied input set** (Section 7) rather than a single prompt list.

### 6.2 Input-variation engine (new — core differentiator)

The system generates a curated set of queries varied along three axes:

- **Intent variation:** genuinely distinct buyer intents for the market (e.g. for 3D printing: rapid prototyping, low-cost small runs, medical-grade parts, large-format), not paraphrases of one query.
- **Persona variation:** different buyer types (budget-conscious startup, enterprise procurement, regulated-industry buyer), which often surface different competitive sets.
- **Framing variation:** different phrasings of a given intent ("best," "most reliable," "affordable," "top-rated near me").

**Critical quality requirement:** variation must produce *genuinely distinct angles*, not paraphrase soup. Twenty near-duplicate rewordings inflate graph volume without adding information; centrality across five truly different intents is more meaningful than across twenty paraphrases. Generation must be deliberate (structured along the axes above), not a naive "give me 50 variations" LLM loop. The system should de-duplicate semantically similar prompts before running them.

The variation set is what populates the graph richly in a single sitting — delivering breadth-of-perspective in the current moment, which is distinct from (and not a substitute for) temporal drift.

### 6.3 Data collection (core pipeline)

- Query ChatGPT, Grok, and Perplexity with each varied input via Bright Data (Web Search API REST, or MCP `GROUPS="geo"`).
- Requests issued in parallel (async) across inputs and engines.
- For each response store: raw answer text, engine, the exact input used (with its intent/persona/framing tags), cited source URLs, timestamp.
- Degrade gracefully: if an engine fails, the run continues and the UI shows which engines/inputs responded.
- **Request budgeting:** each input × engine is a Bright Data request. A 20-input × 3-engine run is 60 requests before sentiment/recommendation LLM calls. Budget against the 5,000 free monthly tier across dev + demo; cache during development.

### 6.4 Knowledge graph layer (Cognee)

- Each run's structured findings are written to a persistent knowledge graph via Cognee's `cognify` step: brands, competitors, source domains, prompts (tagged by intent/persona/framing), engines, and sentiment associations become typed nodes and edges.
- Inferred information (e.g. a sentiment association) stays linked to its source response/citation, per Cognee's source-tracing property.
- The graph is queried (`recall`) **across the run's varied inputs** to compute the structural insights in 6.5–6.7. It is also queried across runs where multiple runs exist.
- Multi-angle accumulation in one sitting is the MVP path to making graph insights meaningful on demo day; cross-run accumulation compounds value over use.

### 6.5 Share-of-voice scoring

- Detect target and competitor mentions per response.
- Compute a transparent 0–100 visibility score from mention rate and position, averaged across inputs and engines.
- **Segment breakdown:** because inputs are tagged, surface score by intent and by persona — not just one global number. "Invisible to enterprise buyers, strong with budget startups" is a more useful and more honest output than a single average.

### 6.6 Citation-gap analysis with centrality

- Identify responses where a competitor is recommended and the target brand is absent; collect cited URLs.
- Use the graph to rank cited domains by **centrality** — how many distinct competitors, inputs, and engines connect to each source. This converts a flat URL list into a prioritized target list: the sources that move many queries at once.
- Be explicit in the UI about which engine each citation came from (Perplexity is the richest citation source).

### 6.7 Consideration-set and sentiment analysis

- **Consideration-set mapping:** from co-citation in the graph, surface which competitors the engines recommend together and through which sources — the AI-perceived consideration set, and whether the target brand is inside or outside it.
- **Sentiment with source tracing:** extract positive/negative associations per brand and link each back to the source(s) feeding it. Present as a current snapshot.
- **Honesty constraint:** all graph-derived patterns scale with data volume. On thin data they demonstrate the mechanism; their reliability grows with accumulated inputs/runs. The UI and demo must not present an unstable, thin-data ranking as settled strategic insight.

### 6.8 Recommendation engine

- **Recommendations (must-have):** synthesize findings (lost intents/personas, winning competitors, central cited sources) into per-gap recommendations — topic/angle, which central sources to target, rationale. Grounded in graph data, prioritized by centrality.
- **Draft artifact (high-value):** generate a draft (blog outline or short post) structured for AI extractability: clear claims, specificity (numbers, named features, comparisons), question-style headers matching how buyers prompt, high information density.
- **Human-in-the-loop:** all output is for human review; the system does not publish.

### 6.9 Dashboard

A single view: visibility score with intent/persona breakdown; per-input mention table; centrality-ranked citation-gap list; consideration-set view; sentiment tags with source links; recommendations with the draft artifact. Run triggered live; a cached full run available as demo fallback.

---

## 7. Input variation vs. temporal drift (design clarification)

### 7.1 Two different kinds of breadth

- **Breadth of perspective (MVP, demoable):** many varied inputs run in one sitting. Answers "how visible am I across the different ways buyers ask, and across segments, *right now*." Populates the graph fast and makes centrality/clustering meaningful immediately.
- **Breadth over time (capability, not demoable):** the same inputs re-run across days/weeks. Answers "how is my visibility *changing*." Requires real elapsed time.

### 7.2 Why this matters

These are not interchangeable. Input variation legitimately solves "populate the graph fast" and "holistic multi-angle analysis." It does **not** solve drift — drift is change in the same query over time, which no amount of input variation in one sitting captures. The pitch may claim fast, rich population through variation; it may not claim drift detection from a single sitting.

### 7.3 Temporal drift status

Architecturally supported (every run is timestamped in the graph; same-input-over-time queries are answerable). Not demoable in a hackathon (no real elapsed time). Framed honestly as a capability that activates with repeated use, never shown as a fabricated trend.

---

## 8. Engine coverage (constraint)

The Bright Data `geo` group queries **ChatGPT, Grok, and Perplexity** — three engines, structured markdown with citations. Gemini, Copilot, and Google AI Overview are not in that group. Google AI Overview is reachable separately via the SERP API.

**MVP commitment:** three engines via `geo`. **Stretch:** Google AI Overview via SERP API for a fourth. Do not claim six.

---

## 9. Technical architecture

- **Backend:** Python + FastAPI. Collection is an async fan-out across varied inputs and engines — not an agent framework. Plain async is more reliable to demo and easier to debug under time pressure.
- **Input-variation engine:** structured generation along intent/persona/framing axes with semantic de-duplication. One LLM call to propose candidates, then filtering — not an uncontrolled loop.
- **Bright Data layer:** Web Search API (direct REST preferred for debuggability) or MCP `GROUPS="geo"`. The whole demo depends on this — validate first (Section 12).
- **Cognee layer:** `cognify` writes each run's findings to the graph; `recall` powers centrality, consideration-set, and sentiment-source queries. Used for graph-shaped problems only — not for storing the user's brand/competitor config (that's plain settings, not memory).
- **AI/ML API:** model-inference provider (partner; $10 credit) routing the LLM calls — sentiment extraction, input-variation generation, recommendation/draft generation. It is plumbing satisfying the partner requirement, not a feature. **Validate that an available model is strong enough for structured extraction and recommendation quality** before committing these calls to it; weak models visibly degrade these outputs.
- **Frontend:** Streamlit for fast solo build, or Next.js single page with a frontend person. Keep thin.
- **Storage:** Cognee graph for structural data; in-memory or JSON/SQLite for the run snapshot / demo fallback. No further database effort for MVP.

---

## 10. Success metrics

**Demo success (the real bar):** a live run completes on stage; the dashboard populates with real, fresh, multi-angle data; the centrality-ranked citation-gap list and consideration-set view return something genuinely meaningful *because the varied-input run gave the graph enough to chew on*; the recommendation is visibly tied to a real, prioritized gap.

**Product-quality signals (post-MVP):** mention-detection accuracy vs. manual review; whether input variation produced distinct angles vs. paraphrases; recommendation relevance judged by a marketer; stability of centrality rankings as data grows.

---

## 11. Risks and mitigations

- **Live call fails on stage.** Pre-run and cache a full run as fallback.
- **Paraphrase soup.** Naive variation inflates volume without information and makes centrality look like noise. Mitigation: structured generation along distinct axes + semantic de-dup; prefer fewer genuinely distinct inputs over many rewordings.
- **Thin-data overclaim.** Presenting an unstable centrality/sentiment ranking as settled insight erodes credibility. Mitigation: input variation gives enough volume in one sitting to be meaningful; still frame graph insight as compounding with use, never as settled on thin data.
- **Drift confusion.** Letting input-variation breadth pass as drift detection is an overclaim a sharp judge will catch. Mitigation: Section 7 keeps them explicitly separate.
- **Empty/thin results for the chosen brand.** Pick a real brand in a category the engines have substantive opinions about; validate first.
- **Free-tier budget exhausted.** Variation multiplies requests (inputs × engines). Budget and cache.
- **AI/ML API model too weak.** Validate extraction/recommendation quality on an available model before committing.
- **Scope creep.** The variation engine and graph are additive and fast to add but worthless without a working core pipeline. Build share-of-voice + citation-gap live first; layer variation, then Cognee, then recommendations.
- **Overclaiming generally.** Six engines, autonomous optimization, proven ranking impact, demoable drift — all unbackable. Non-goals are load-bearing.

---

## 12. Pre-build checklist

- [ ] Bright Data account + API token in hand.
- [ ] `geo` group / Web Search API validated against a real test brand — returns answers + citations as expected. **Do this first.**
- [ ] AI/ML API access confirmed; an available model validated as strong enough for structured extraction and recommendation generation.
- [ ] Cognee installed and a trivial cognify/recall round-trip working before wiring real data.
- [ ] Free-tier request budget estimated for variation-multiplied dev + demo runs.
- [ ] Real demo brand + competitors + market chosen and validated for substantive, multi-angle engine output.
- [ ] Demo script written; full varied-input run pre-cached as fallback.

---

## 13. Build sequence

1. Bright Data pipeline: async fan-out (single prompt set first), store raw responses + citations.
2. Share-of-voice scoring: mention detection + transparent formula.
3. Citation-gap analysis: collect competitor-cited URLs.
4. Dashboard: thin single page wiring the above together. **(Items 1–4 = demonstrable core; harden before proceeding.)**
5. Input-variation engine: structured intent/persona/framing generation + semantic de-dup; expand the fan-out to the varied set.
6. Cognee layer: cognify run findings; recall for centrality, consideration-set, sentiment-source queries; add segment breakdowns and centrality ranking to the dashboard.
7. Sentiment with source tracing.
8. Recommendation engine: grounded, centrality-prioritized recommendations + one draft artifact.
9. Stretch: Google AI Overview via SERP API as a fourth engine.

Cut from the bottom up if time runs short.

---

## 14. Roadmap (post-MVP)

- Temporal drift activated by repeated runs over real time — visibility and sentiment change tracking on the already-timestamped graph.
- Expanded engine coverage (Gemini, Copilot, Google AI Overview first-class).
- Outcome-learning memory (Cognee skill-routing pattern): learn which intents/personas are most diagnostic and which recommendation angles users accept, improving runs over time.
- Human-in-the-loop publishing workflow with CMS integration (artifacts reviewed, then shipped).
- Multi-brand / multi-client agency workspaces with auth and billing.
- Recommendation impact measurement once longitudinal data can correlate actions with visibility change.
