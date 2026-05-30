"""
Recommendation engine — Step 8 of the build sequence.

One gpt-4o-mini call grounded in the run's actual data:
  - Citation gaps (centrality-ranked sources where competitors won)
  - Sentiment findings per brand per engine
  - Segment gaps narrative from Cognee (if available)
  - Visibility score components

Returns 3–5 Recommendations + one DraftArtifact.
"""
import json
from openai import AsyncOpenAI
from . import config
from .models import (
    BrandSentiment, CitationGapEntry, DraftArtifact,
    Recommendation, RunConfig, ScoreResult,
)

_SYSTEM = """\
You are a GEO (Generative Engine Optimization) strategist analyzing an AI-visibility audit.

Generate 3–5 specific, prioritized recommendations based ONLY on the data provided.
Every recommendation must cite concrete evidence: domain names, competitor names, engine \
names, or segments from the data. No generic marketing advice.

Also generate one draft content artifact that directly addresses the highest-priority gap.
Choose the most appropriate artifact type given the data (blog_post_outline, pr_pitch, \
content_brief, or faq_page).

Return ONLY valid JSON:
{
  "recommendations": [
    {
      "title": "Short action name (≤8 words)",
      "rationale": "Why this gap matters — cite specific domains, competitors, or engines",
      "action": "Concrete next step the team can act on this week",
      "priority": "high|medium|low",
      "target_source": "domain.com or empty string"
    }
  ],
  "artifact": {
    "artifact_type": "blog_post_outline|pr_pitch|content_brief|faq_page",
    "title": "Specific, actionable title",
    "content": "The actual draft content (250–400 words)"
  }
}

Sort recommendations by priority descending (high first).
"""


def _build_user_message(
    cfg: RunConfig,
    score_result: ScoreResult,
    gap_list: list[CitationGapEntry],
    sentiments: list[BrandSentiment] | None,
    segment_gaps_narrative: str,
) -> str:
    comp = score_result.components
    lines = [
        f"VISIBILITY AUDIT — {cfg.target_brand}",
        f"Market: {cfg.market}",
        f"Visibility score: {score_result.visibility_score}/100 "
        f"(mentioned in {comp.get('mention_count', '?')}/{comp.get('total_responses', '?')} responses)",
        "",
        "Score by engine:",
    ]
    for eng, val in score_result.by_engine.items():
        lines.append(f"  {eng}: {val}/100")

    lines += ["", f"TOP CITATION GAPS (sources cited when competitors won; {cfg.target_brand} absent):"]
    top_gaps = gap_list[:5]
    if top_gaps:
        for i, g in enumerate(top_gaps, 1):
            lines.append(
                f"  {i}. {g.domain} — centrality {g.centrality_score}, "
                f"competitors: {', '.join(g.reaching_competitors)}, "
                f"engines: {', '.join(g.reaching_engines)}"
            )
    else:
        lines.append("  None — brand appeared in all competitor responses.")

    if sentiments:
        lines += ["", "BRAND SENTIMENT FINDINGS:"]
        for s in sentiments:
            domains = ", ".join(s.source_domains[:3]) or "—"
            lines.append(
                f"  {s.brand} ({s.engine}): {s.polarity} — {s.trait} | sources: {domains}"
            )

    if segment_gaps_narrative and segment_gaps_narrative != "No graph data available for this query.":
        lines += ["", "SEGMENT GAPS (from knowledge graph):"]
        lines.append(f"  {segment_gaps_narrative[:600]}")

    return "\n".join(lines)


async def recommend(
    cfg: RunConfig,
    score_result: ScoreResult,
    gap_list: list[CitationGapEntry],
    sentiments: list[BrandSentiment] | None = None,
    segment_gaps_narrative: str = "",
) -> tuple[list[Recommendation], DraftArtifact | None]:
    if not config.OPENAI_API_KEY:
        return [], None

    client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)
    user_msg = _build_user_message(cfg, score_result, gap_list, sentiments, segment_gaps_narrative)

    response = await client.chat.completions.create(
        model=config.LLM_MODEL,
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
        max_tokens=1800,
    )

    raw = json.loads(response.choices[0].message.content)

    recs = [
        Recommendation(
            title=item.get("title", ""),
            rationale=item.get("rationale", ""),
            action=item.get("action", ""),
            priority=item.get("priority", "medium"),
            target_source=item.get("target_source", ""),
        )
        for item in raw.get("recommendations") or []
        if item.get("title")
    ]

    artifact = None
    art_raw = raw.get("artifact")
    if art_raw and art_raw.get("title"):
        artifact = DraftArtifact(
            artifact_type=art_raw.get("artifact_type", "content_brief"),
            title=art_raw.get("title", ""),
            content=art_raw.get("content", ""),
        )

    return recs, artifact
