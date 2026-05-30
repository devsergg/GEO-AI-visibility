"""
Cognee layer — ingest ParsedResults into the local knowledge graph and expose
semantic recall queries for the dashboard's Graph Insights section.

Architecture (validated 2026-05-29):
  - remember() ingests structured text; Cognee auto-extracts entities/edges.
  - recall() returns synthesized narrative answers, not raw rows.
  - Structural numbers (SOV, citation-gap counts) stay in scorer.py.
  - This module adds: consideration-set narrative, absence explanation,
    centrality narrative, and sentiment-with-source narrative.

Performance config applied at import time:
  - text-embedding-3-small (1536 dims) instead of default large (3072) — faster, sufficient
  - chunk_size=4000 — fits our entire payload in one chunk → one extraction LLM call
  - self_improvement=False on remember() — skips the post-ingest graph enrichment pass
"""
import asyncio
import os
import shutil

import cognee

from .models import ParsedResult, RunConfig

# Apply performance config once at import — before any remember/recall calls
EMBEDDING_MODEL = "openai/text-embedding-3-small"
EMBEDDING_DIMS = 1536

cognee.config.set_embedding_model(EMBEDDING_MODEL)
cognee.config.set_embedding_dimensions(EMBEDDING_DIMS)
cognee.config.set_chunk_size(4000)


def reset_databases() -> None:
    """Wipe Cognee's local databases. Required when changing embedding dimensions.

    Run this manually from a script (not from Streamlit) if you change
    EMBEDDING_MODEL or EMBEDDING_DIMS above — LanceDB won't auto-migrate.
    """
    db_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        ".venv/lib/python3.14/site-packages/cognee/.cognee_system/databases",
    )
    if os.path.exists(db_dir):
        shutil.rmtree(db_dir)
        os.makedirs(db_dir)
        print(f"Wiped and recreated: {db_dir}")


def _format_result(r: ParsedResult, target_brand: str) -> str:
    """Serialize one ParsedResult into the structured text Cognee ingests."""
    brands = ", ".join(
        f"{m.brand} (pos {m.position}{'*rec*' if m.is_recommendation else ''})"
        for m in r.mentions
    ) or "none"
    citations = ", ".join(c.url for c in r.citations) or "none"
    target_mentioned = any(
        m.brand.lower() == target_brand.lower() for m in r.mentions
    )
    target_recommended = any(
        m.brand.lower() == target_brand.lower() and m.is_recommendation
        for m in r.mentions
    )

    return f"""GEO RESPONSE
run_id: {r.run_id}
engine: {r.engine}
prompt_id: {r.prompt_id}
prompt_text: {r.prompt_text}
timestamp: {r.timestamp}

BRANDS MENTIONED: {brands}
TARGET BRAND ({target_brand}) MENTIONED: {"Yes" if target_mentioned else "No"}
TARGET BRAND RECOMMENDED: {"Yes" if target_recommended else "No"}
CITATIONS: {citations}
RESPONDED: {"Yes" if r.responded else "No — " + (r.error or "unknown error")}"""


async def ingest(results: list[ParsedResult], cfg: RunConfig) -> None:
    """Ingest all ParsedResults as a single batched remember() call.

    Batching into one payload means Cognee runs its pipeline once (~30s) instead
    of once per result (~30s × N). Sequential calls also hit duplicate-detection
    skips on the second+ call. Validated approach: one combined payload, one call.
    """
    blocks = [_format_result(r, cfg.target_brand) for r in results]
    combined = f"GEO RUN SUMMARY\nrun_id: {cfg.run_id}\ntarget_brand: {cfg.target_brand}\n\n"
    combined += "\n\n---\n\n".join(blocks)
    await cognee.remember(combined, self_improvement=False)


# ── Recall queries (return narrative text) ────────────────────────────────────

async def recall_consideration_set(run_id: str, target_brand: str) -> str:
    """Which brands are co-mentioned/co-recommended? Is target in the cluster?"""
    results = await cognee.recall(
        query_text=(
            f"In run {run_id}: which brands appear together most often in recommendations? "
            f"Is {target_brand} part of the dominant consideration set or absent from it?"
        ),
    )
    return _first_text(results)


async def recall_absence_explanation(run_id: str, target_brand: str) -> str:
    """When target brand is absent, which competitors took its place and via which sources?"""
    results = await cognee.recall(
        query_text=(
            f"In run {run_id}: in responses where {target_brand} was NOT mentioned, "
            f"which brands were recommended instead, and which sources cited those brands?"
        ),
    )
    return _first_text(results)


async def recall_centrality_narrative(run_id: str, target_brand: str) -> str:
    """Which cited sources appear most across competitor-recommending responses?"""
    results = await cognee.recall(
        query_text=(
            f"In run {run_id}: which websites or sources are cited most often in responses "
            f"that recommend competitors of {target_brand}? Which sources appear across the "
            f"most distinct intents and engines?"
        ),
    )
    return _first_text(results)


async def recall_sentiment_sources(run_id: str, target_brand: str) -> str:
    """Which sources are associated with negative or mixed coverage of the target brand?"""
    results = await cognee.recall(
        query_text=(
            f"In run {run_id}: what is the sentiment around {target_brand} in these responses? "
            f"Are there sources or engines that give more negative or critical coverage?"
        ),
    )
    return _first_text(results)


async def recall_segment_gaps(run_id: str, target_brand: str) -> str:
    """Which intent/persona segments show lowest target brand visibility?"""
    results = await cognee.recall(
        query_text=(
            f"In run {run_id}: which buyer intents or personas show {target_brand} mentioned "
            f"least often? Which intents and personas are dominated by competitors?"
        ),
    )
    return _first_text(results)


def _first_text(results) -> str:
    if not results:
        return "No graph data available for this query."
    first = results[0]
    return getattr(first, "text", None) or getattr(first, "content", None) or str(first)


async def recall_all(run_id: str, target_brand: str) -> dict[str, str]:
    """Run all 5 recall queries without re-ingesting. Use when ingest already done."""
    consideration, absence, centrality, sentiment, segments = await asyncio.gather(
        recall_consideration_set(run_id, target_brand),
        recall_absence_explanation(run_id, target_brand),
        recall_centrality_narrative(run_id, target_brand),
        recall_sentiment_sources(run_id, target_brand),
        recall_segment_gaps(run_id, target_brand),
    )
    return {
        "consideration_set": consideration,
        "absence_explanation": absence,
        "centrality_narrative": centrality,
        "sentiment_sources": sentiment,
        "segment_gaps": segments,
    }


async def run_all_insights(results: list[ParsedResult], cfg: RunConfig) -> dict[str, str]:
    """Ingest results then run all insight queries. Returns dict of narrative strings."""
    await ingest(results, cfg)
    return await recall_all(cfg.run_id, cfg.target_brand)
