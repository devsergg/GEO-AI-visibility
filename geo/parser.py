import re, datetime
import uuid
from .models import Prompt, ParsedResult, Mention, Citation


def parse(run_id: str, prompt: Prompt, engine: str, raw: dict,
          target_brand: str, competitors: list[str],
          raw_text: str, citations_raw: list[dict]) -> ParsedResult:
    brands = [target_brand] + competitors
    mentions = _detect_mentions(raw_text, brands)
    citations = [
        Citation(domain=c["domain"], url=c["url"]) for c in citations_raw
    ]
    return ParsedResult(
        run_id=run_id,
        prompt_id=prompt.id,
        prompt_text=prompt.text,
        engine=engine,
        raw_text=raw_text,
        timestamp=datetime.datetime.utcnow().isoformat() + "Z",
        mentions=mentions,
        citations=citations,
        responded=bool(raw_text),
    )


def _detect_mentions(text: str, brands: list[str]) -> list[Mention]:
    """
    Find brand mentions in order of appearance. Position = rank of first occurrence.
    A mention counts as a recommendation if it appears in a context suggesting
    endorsement (near "recommend", "best", "top", "consider", etc.).
    """
    if not text:
        return []

    rec_pattern = re.compile(
        r"(best|top|recommend|consider|great|ideal|perfect|leading|#\d|[\d]+\.|"
        r"✓|excellent|strong|popular|widely used)",
        re.IGNORECASE,
    )
    text_lower = text.lower()
    found: list[tuple[int, str]] = []  # (char_offset, brand)

    for brand in brands:
        pattern = re.compile(re.escape(brand), re.IGNORECASE)
        match = pattern.search(text)
        if match:
            found.append((match.start(), brand))

    found.sort(key=lambda x: x[0])

    mentions = []
    for position, (offset, brand) in enumerate(found, start=1):
        window = text[max(0, offset - 120): offset + 120]
        is_rec = bool(rec_pattern.search(window))
        mentions.append(Mention(brand=brand, position=position, is_recommendation=is_rec))

    return mentions
