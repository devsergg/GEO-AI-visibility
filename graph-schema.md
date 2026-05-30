# GEO Command Center — Knowledge Graph Schema (Cognee)

**Version:** 0.2
**Companion to:** PRD v0.2, data-contract.md
**Status:** VERIFIED 2026-05-29 via live validation run (scripts/validate_cognee.py).

**Validated API:** `cognee.remember(text, dataset_id=)` / `cognee.recall(query_text=, datasets=[])` / `cognee.forget(everything=True)`.
Old names `cognify`/`search` still work but use the new API.
`recall()` returns synthesized narrative text, not raw graph rows — use for insight copy, not structured tables.
Structural numbers (SOV, citation-gap counts, segment breakdowns) stay in scorer.py; Cognee adds semantic narrative on top.

**Ingestion approach:** Structured text per ParsedResult (see geo/cognee_store.py `_format_result()`). Cognee auto-extracts entities and relationships — validated to correctly identify brands, citations, intent, persona, and absence ("Acme PM was NOT mentioned"). No need for explicit node/edge insertion.

---

## 1. Purpose

This schema defines the entities and relationships written to the Cognee knowledge graph from each run. It exists so that the structural queries the product depends on — source centrality, consideration-set membership, sentiment-to-source tracing — are answerable rather than improvised. Get this right before data flows through it; retrofitting a schema after ingestion is expensive.

The graph is populated from **many varied inputs in a single run** (breadth of perspective) and **accumulates across runs** (breadth over time). Every node and edge therefore carries enough tagging to slice by intent, persona, framing, engine, and run/time.

---

## 2. Node types

| Node type | Description | Key properties |
|-----------|-------------|----------------|
| `Brand` | The target brand or a competitor. One node per distinct brand, reused across runs. | `name`, `is_target` (bool) |
| `Source` | A cited domain/URL returned by an engine. Keyed by normalized domain so citations aggregate. | `domain`, `example_url` |
| `Prompt` | A single varied input that was sent to engines. | `text`, `intent`, `persona`, `framing` |
| `Engine` | An AI engine queried. Fixed small set. | `name` (chatgpt \| grok \| perplexity \| google_ai_overview) |
| `Response` | One engine's answer to one prompt in one run. The provenance anchor — every inferred fact links back to a Response. | `run_id`, `timestamp`, `raw_text_ref` |
| `SentimentAssociation` | An extracted positive/negative trait associated with a brand. | `polarity` (positive \| negative \| neutral), `trait`, `confidence` |
| `Run` | A single execution of the pipeline. Enables cross-run and temporal queries. | `run_id`, `timestamp`, `target_brand`, `market` |

**Provenance rule (mirrors Cognee's design):** every inferred node (`SentimentAssociation`, and any mention/recommendation fact) must connect back to the `Response` it was derived from, so the UI can always show "this association came from this answer to this prompt on this engine." Do not store inferred facts detached from their source.

---

## 3. Edge types

| Edge | From → To | Meaning | Carries |
|------|-----------|---------|---------|
| `MENTIONED_IN` | Brand → Response | Brand was named in this response | `position` (rank/order of mention), `is_recommendation` (bool) |
| `CITES` | Response → Source | This response cited this source | — |
| `RECOMMENDS_VIA` | Response → Brand | Response recommended this brand (subset of MENTIONED_IN where it's an endorsement) | — |
| `PROMPTED_BY` | Response → Prompt | Which input produced this response | — |
| `FROM_ENGINE` | Response → Engine | Which engine produced this response | — |
| `PART_OF_RUN` | Response → Run | Which run this belongs to | — |
| `HAS_SENTIMENT` | Brand → SentimentAssociation | Brand carries this association | — |
| `DERIVED_FROM` | SentimentAssociation → Response | Provenance: the response that fed this association | — |

---

## 4. The queries this schema must answer

These are the reason the schema is shaped this way. If a change to the schema breaks one of these, it's the wrong change.

### 4.1 Source centrality (citation-gap prioritization)
For sources cited in responses that recommend a competitor but do **not** mention the target brand: rank each `Source` by how many *distinct* competitors, prompts, and engines connect to it (via `CITES` from qualifying `Response` nodes). High-degree sources are the structurally central targets — they move many queries at once.

> Centrality = count of distinct (Brand, Prompt, Engine) tuples reaching the Source through competitor-recommending responses. Across a varied-input run this is meaningful in one sitting; it sharpens further across runs.

### 4.2 Consideration-set mapping
Find sets of `Brand` nodes that are co-recommended (`RECOMMENDS_VIA` from the same or overlapping `Response`/`Source` clusters). Determine whether the target brand is inside or outside the dominant cluster, and which `Source` nodes define membership.

### 4.3 Sentiment-to-source tracing
For each negative `SentimentAssociation` on the target brand, traverse `DERIVED_FROM` → `Response` → `CITES` → `Source` to surface which sources are likely feeding the perception.

### 4.4 Segment breakdown
Because `Prompt` carries `intent` and `persona`, aggregate mentions/recommendations grouped by those tags to produce per-segment visibility (e.g. strong with `persona=budget_startup`, absent with `persona=enterprise`).

### 4.5 Temporal drift (capability, not demoed)
Because `Run` and `Response` carry timestamps, the same `Prompt` text can be compared across `Run` nodes over real time. Architecturally supported; only meaningful with runs separated by real elapsed time. Not a single-sitting query — do not let input-variation breadth stand in for this.

---

## 5. Honesty constraints baked into the schema

- Graph-derived rankings (centrality, consideration-set) gain reliability with data volume. A varied-input run gives enough to be meaningful in a demo; the UI should still not present a thin-data ranking as settled.
- Input variation populates 4.1–4.4. It does **not** populate 4.5. Keep them distinct in code and in any surfaced output.

---

## 6. Implementation note

Confirm how Cognee wants these entities expressed (it builds graphs from text/structured input via `cognify`; the exact ingestion format — typed objects vs. structured text — must be checked against a real round-trip). Whatever the ingestion mechanism, preserve the node types, edge types, tags, and the provenance rule above. If Cognee's auto-extraction produces a different shape than intended, prefer explicit structured ingestion so the queries in Section 4 remain answerable.
