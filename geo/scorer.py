from collections import defaultdict
from .models import ParsedResult, ScoreResult, CitationGapEntry


def score(run_id: str, target_brand: str, competitors: list[str],
          results: list[ParsedResult],
          prompts_meta: dict[str, dict]) -> ScoreResult:
    """
    Compute transparent share-of-voice score.

    Formula (exposed in components):
      mention_rate   = responses_mentioning_target / total_responded
      position_score = 1 - ((avg_position - 1) / max_position)  [0..1, higher=better]
      visibility_score = (mention_rate * 0.7 + position_score * 0.3) * 100
    """
    responded = [r for r in results if r.responded]
    total = len(responded)
    if total == 0:
        return ScoreResult(
            run_id=run_id, target_brand=target_brand,
            visibility_score=0.0, by_intent={}, by_persona={}, by_engine={},
            components={"error": "no responses"}, mention_rate=0.0, avg_position=None,
        )

    target_lower = target_brand.lower()

    def _mentions_target(r: ParsedResult) -> bool:
        return any(m.brand.lower() == target_lower for m in r.mentions)

    def _target_position(r: ParsedResult) -> int | None:
        for m in r.mentions:
            if m.brand.lower() == target_lower:
                return m.position
        return None

    mention_count = sum(1 for r in responded if _mentions_target(r))
    mention_rate = mention_count / total

    positions = [p for r in responded if (p := _target_position(r)) is not None]
    avg_position = sum(positions) / len(positions) if positions else None
    max_pos = max((len(r.mentions) for r in responded if r.mentions), default=1) or 1
    position_score = (1 - ((avg_position - 1) / max_pos)) if avg_position else 0.0
    position_score = max(0.0, min(1.0, position_score))

    visibility_score = round((mention_rate * 0.7 + position_score * 0.3) * 100, 1)

    # Segment breakdowns
    by_intent: dict[str, list] = defaultdict(list)
    by_persona: dict[str, list] = defaultdict(list)
    by_engine: dict[str, list] = defaultdict(list)

    for r in responded:
        meta = prompts_meta.get(r.prompt_id, {})
        intent = meta.get("intent", "unknown")
        persona = meta.get("persona", "unknown")
        hit = 1 if _mentions_target(r) else 0
        by_intent[intent].append(hit)
        by_persona[persona].append(hit)
        by_engine[r.engine].append(hit)

    def _avg(lst): return round(sum(lst) / len(lst) * 100, 1) if lst else 0.0

    return ScoreResult(
        run_id=run_id,
        target_brand=target_brand,
        visibility_score=visibility_score,
        by_intent={k: _avg(v) for k, v in by_intent.items()},
        by_persona={k: _avg(v) for k, v in by_persona.items()},
        by_engine={k: _avg(v) for k, v in by_engine.items()},
        components={
            "total_responses": total,
            "mention_count": mention_count,
            "mention_rate": round(mention_rate, 3),
            "avg_position": round(avg_position, 2) if avg_position else None,
            "position_score": round(position_score, 3),
            "weight_mention": 0.7,
            "weight_position": 0.3,
        },
        mention_rate=mention_rate,
        avg_position=avg_position,
    )


def citation_gap(target_brand: str, results: list[ParsedResult]) -> list[CitationGapEntry]:
    """
    Identify citation sources from responses where a competitor is recommended
    but the target brand is absent. Rank by centrality.
    """
    target_lower = target_brand.lower()
    # source → {competitors, intents, engines, urls}
    source_map: dict[str, dict] = defaultdict(lambda: {
        "competitors": set(), "intents": set(), "engines": set(), "urls": set()
    })

    for r in results:
        if not r.responded:
            continue
        brands_mentioned = {m.brand.lower() for m in r.mentions}
        target_present = target_lower in brands_mentioned
        if target_present:
            continue  # target was mentioned — not a gap

        competitor_recs = [
            m.brand for m in r.mentions
            if m.is_recommendation and m.brand.lower() != target_lower
        ]
        if not competitor_recs:
            continue

        for c in r.citations:
            entry = source_map[c.domain]
            entry["competitors"].update(competitor_recs)
            entry["engines"].add(r.engine)
            entry["urls"].add(c.url)
            # intent/persona from prompt_id — caller attaches via prompts_meta if needed

    entries = []
    for domain, data in source_map.items():
        nc = len(data["competitors"])
        ne = len(data["engines"])
        centrality = round(nc * ne, 2)  # will add intent dimension when Cognee added
        entries.append(CitationGapEntry(
            domain=domain,
            urls=list(data["urls"]),
            competitor_count=nc,
            prompt_count=0,
            engine_count=ne,
            centrality_score=centrality,
            reaching_competitors=sorted(data["competitors"]),
            reaching_intents=[],
            reaching_engines=sorted(data["engines"]),
        ))

    entries.sort(key=lambda e: e.centrality_score, reverse=True)
    return entries
