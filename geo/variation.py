"""
Input-variation engine.

One gpt-4o-mini call generates a structured set of prompts varied along
intent × persona × framing axes. Semantic de-dup runs after generation
to drop near-paraphrases before the prompts hit Bright Data.
"""
import json, uuid, difflib
from openai import OpenAI
from . import config
from .models import Prompt, VariationConfig

_client = None


def _llm() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=config.OPENAI_API_KEY)
    return _client


_SYSTEM = """\
You are a market research assistant generating AI-search queries for a GEO
(Generative Engine Optimization) visibility audit.

Given a brand, its competitors, and a market category, generate a set of
search queries a buyer might ask an AI assistant. Vary them along THREE axes:

1. INTENT  – genuinely distinct buyer goals (not paraphrases).
   Examples for CRM: "automate follow-up emails", "track sales pipeline",
   "manage customer support tickets", "import contacts from spreadsheet".

2. PERSONA – different buyer types who have different competitive shortlists.
   Examples: budget-conscious startup, enterprise procurement team,
   solo freelancer, regulated-industry buyer.

3. FRAMING – phrasing style: "best X for Y", "compare X vs Y",
   "most affordable X", "which X do professionals use", "top-rated X".

Rules:
- Each query must be genuinely distinct — no near-paraphrases.
- Queries should be phrased as a real user would type them into ChatGPT/Perplexity.
- Do NOT mention the target brand in any query.
- Return ONLY a JSON array. Each item: {"text","intent","persona","framing"}.
- Aim for variety: cover as many (intent, persona) combinations as the cap allows.
"""


def generate(
    target_brand: str,
    competitors: list[str],
    market: str,
    variation_cfg: VariationConfig,
) -> list[Prompt]:
    cap = variation_cfg.max_prompts

    user_msg = (
        f"Target brand: {target_brand}\n"
        f"Competitors: {', '.join(competitors)}\n"
        f"Market: {market}\n"
        f"Intents to cover: {', '.join(variation_cfg.intents)}\n"
        f"Personas to cover: {', '.join(variation_cfg.personas)}\n"
        f"Framings to use: {', '.join(variation_cfg.framings)}\n"
        f"Generate up to {cap} queries. Fewer genuinely distinct > more paraphrases."
    )

    response = _llm().chat.completions.create(
        model=config.LLM_MODEL,
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        response_format={"type": "json_object"},
        temperature=0.7,
        max_tokens=2000,
    )

    raw = json.loads(response.choices[0].message.content)
    # Accept both {"queries": [...]} and a bare array
    items = raw if isinstance(raw, list) else raw.get("queries") or raw.get("prompts") or []

    prompts = [
        Prompt(
            id=f"p{i:02d}_{uuid.uuid4().hex[:4]}",
            text=item.get("text", "").strip(),
            intent=item.get("intent", "unknown"),
            persona=item.get("persona", "unknown"),
            framing=item.get("framing", "unknown"),
        )
        for i, item in enumerate(items)
        if item.get("text", "").strip()
    ]

    if variation_cfg.dedup:
        prompts = _dedup(prompts)

    return prompts[:cap]


def _dedup(prompts: list[Prompt], threshold: float = 0.82) -> list[Prompt]:
    """Drop prompts whose text is too similar to an already-kept prompt."""
    kept: list[Prompt] = []
    for candidate in prompts:
        if not any(
            difflib.SequenceMatcher(None, candidate.text.lower(), k.text.lower()).ratio()
            > threshold
            for k in kept
        ):
            kept.append(candidate)
    return kept


def generate_variation_config(market: str, brand: str) -> VariationConfig:
    """
    Ask gpt-4o-mini to produce market-specific intents, personas, and framings.
    Falls back to defaults if the call fails.
    """
    try:
        prompt = (
            f'Market category: "{market}"\n'
            f'Brand being audited: "{brand}"\n\n'
            "Return a JSON object with exactly three keys:\n"
            '- "intents": list of 5 genuinely distinct buyer goals in this market '
            "(specific to the category, not generic)\n"
            '- "personas": list of 4 buyer types who evaluate products in this market '
            "(think about who actually buys here and what their priorities differ by)\n"
            '- "framings": list of 5 query phrasing styles a buyer would use '
            '(e.g. "best X for Y", "compare X vs Y", "most affordable X")\n\n'
            "Be specific to the market — avoid generic phrases like "
            '"find the best tool" or "budget-conscious startup".'
        )
        response = _llm().chat.completions.create(
            model=config.LLM_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a market research specialist. "
                        "Return JSON only. Be specific to the given market — "
                        "generic buyer intents and personas are useless."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.4,
            max_tokens=600,
        )
        data = json.loads(response.choices[0].message.content)
        intents = [str(x) for x in data.get("intents", []) if x][:6]
        personas = [str(x) for x in data.get("personas", []) if x][:5]
        framings = [str(x) for x in data.get("framings", []) if x][:6]
        if intents and personas and framings:
            return VariationConfig(intents=intents, personas=personas, framings=framings, max_prompts=15, dedup=True)
    except Exception:
        pass
    return _default_variation()


def _default_variation() -> VariationConfig:
    """Static fallback used when the LLM call in generate_variation_config fails."""
    return VariationConfig(
        intents=[
            "find the best tool for the job",
            "compare options by price",
            "evaluate for enterprise use",
            "get started quickly as a small team",
            "migrate from an existing solution",
        ],
        personas=[
            "budget-conscious startup founder",
            "enterprise procurement manager",
            "solo freelancer or consultant",
            "marketing team lead at a mid-size company",
        ],
        framings=[
            "best",
            "most affordable",
            "compare vs alternatives",
            "top-rated",
            "recommended by professionals",
        ],
        max_prompts=15,
        dedup=True,
    )
