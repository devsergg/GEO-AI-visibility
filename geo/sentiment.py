"""
Sentiment with source tracing — Step 7 of the build sequence.

One gpt-4o-mini call per engine group (parallel). For each brand mentioned
across that engine's responses, extracts:
  - polarity: positive | neutral | negative | mixed
  - trait:    one concise phrase (≤12 words)
  - source_domains: citation domains that appear alongside this brand

Call: await analyze(results, cfg) → list[BrandSentiment]
"""
import asyncio
import json
from openai import AsyncOpenAI
from . import config
from .models import BrandSentiment, ParsedResult, RunConfig

_SYSTEM = """\
You analyze AI-generated market research responses for brand sentiment.

Given several responses from one AI engine, determine the sentiment toward each brand.
For each brand that appears:
  polarity — "positive" | "neutral" | "negative" | "mixed"
  trait     — one concise phrase (≤12 words) describing how the engine frames the brand
  source_domains — list of citation domains that appear in responses mentioning this brand

Return ONLY a JSON array. Each item:
  {"brand": "...", "polarity": "...", "trait": "...", "source_domains": ["..."]}

Rules:
- Omit brands not mentioned in any response.
- positive  = consistently framed as a top pick or recommendation
- negative  = criticized or warned against
- mixed     = positive in some responses, lukewarm/negative in others
- neutral   = mentioned without strong endorsement or criticism
- source_domains = only domains from CITATIONS lines co-occurring with this brand's mentions
- Keep trait specific; avoid vague phrases like "good product" or "popular option"
"""


def _format_engine_block(engine: str, results: list[ParsedResult]) -> str:
    parts = [f"Engine: {engine}\n"]
    for r in results:
        domains = ", ".join(c.domain for c in r.citations) or "none"
        parts.append(
            f"--- {r.engine} / {r.prompt_id} ---\n"
            f"PROMPT: {r.prompt_text}\n"
            f"TEXT: {r.raw_text[:700]}\n"
            f"CITATIONS: {domains}\n"
        )
    return "\n".join(parts)


async def _analyze_engine(
    client: AsyncOpenAI,
    engine: str,
    results: list[ParsedResult],
    cfg: RunConfig,
) -> list[BrandSentiment]:
    all_brands = [cfg.target_brand] + cfg.competitors
    user_msg = (
        f"All brands to check: {', '.join(all_brands)}\n\n"
        + _format_engine_block(engine, results)
    )

    response = await client.chat.completions.create(
        model=config.LLM_MODEL,
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
        max_tokens=1200,
    )

    raw = json.loads(response.choices[0].message.content)
    items = raw if isinstance(raw, list) else (
        raw.get("sentiments") or raw.get("brands") or raw.get("results") or []
    )

    return [
        BrandSentiment(
            brand=item.get("brand", ""),
            polarity=item.get("polarity", "neutral"),
            trait=item.get("trait", ""),
            source_domains=item.get("source_domains") or [],
            engine=engine,
        )
        for item in items
        if item.get("brand")
    ]


async def analyze(results: list[ParsedResult], cfg: RunConfig) -> list[BrandSentiment]:
    """Run sentiment extraction for all engines in parallel."""
    if not config.OPENAI_API_KEY:
        return []

    # Group succeeded results by engine
    by_engine: dict[str, list[ParsedResult]] = {}
    for r in results:
        if r.responded:
            by_engine.setdefault(r.engine, []).append(r)

    if not by_engine:
        return []

    client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)
    tasks = [
        _analyze_engine(client, engine, engine_results, cfg)
        for engine, engine_results in by_engine.items()
    ]
    nested = await asyncio.gather(*tasks, return_exceptions=True)

    out: list[BrandSentiment] = []
    for item in nested:
        if isinstance(item, list):
            out.extend(item)
    return out
