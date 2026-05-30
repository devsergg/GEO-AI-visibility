"""
Async fan-out pipeline: RunConfig → list[ParsedResult].
One task per (prompt, engine) pair; all run concurrently.
"""
import asyncio, json, os, uuid, datetime
from . import config
from .models import RunConfig, Prompt, ParsedResult
from .engines import get_engine
from .parser import parse


def _make_prompts(run_cfg: RunConfig) -> list[Prompt]:
    """Build the prompt list. Uses variation engine if config provided, else fixed set."""
    if run_cfg.variation:
        from .variation import generate
        return generate(
            target_brand=run_cfg.target_brand,
            competitors=run_cfg.competitors,
            market=run_cfg.market,
            variation_cfg=run_cfg.variation,
        )

    # Fallback: minimal fixed prompt set (no LLM key needed)
    templates = [
        f"What are the best {run_cfg.market} options?",
        f"Which companies offer the best {run_cfg.market}?",
        f"Who are the top providers for {run_cfg.market}?",
        f"What {run_cfg.market} solution would you recommend for a small business?",
        f"Compare the leading {run_cfg.market} tools.",
    ]
    prompts = []
    for i, text in enumerate(templates):
        prompts.append(Prompt(
            id=f"p{i:02d}",
            text=text,
            intent="product_discovery",
            persona="general_buyer",
            framing=["best", "top", "recommend", "small_business", "compare"][i],
        ))
    return prompts


async def _run_one(run_id: str, prompt: Prompt, engine_name: str,
                   target_brand: str, competitors: list[str]) -> ParsedResult:
    try:
        engine = get_engine(engine_name)
        raw = await engine.query(prompt)
        text = engine.extract_text(raw)
        citations_raw = engine.extract_citations(raw)
        return parse(run_id, prompt, engine_name, raw, target_brand, competitors,
                     text, citations_raw)
    except Exception as exc:
        return ParsedResult(
            run_id=run_id,
            prompt_id=prompt.id,
            prompt_text=prompt.text,
            engine=engine_name,
            raw_text="",
            timestamp=datetime.datetime.utcnow().isoformat() + "Z",
            mentions=[],
            citations=[],
            responded=False,
            error=str(exc),
        )


async def run(cfg: RunConfig) -> list[ParsedResult]:
    prompts = _make_prompts(cfg)
    tasks = [
        _run_one(cfg.run_id, prompt, engine, cfg.target_brand, cfg.competitors)
        for prompt in prompts
        for engine in cfg.engines
    ]
    results = await asyncio.gather(*tasks)
    _cache(cfg, list(results))
    return list(results)


async def run_with_insights(cfg: RunConfig) -> tuple[list[ParsedResult], dict[str, str]]:
    """Run the full pipeline and ingest results into Cognee for graph insights."""
    from .cognee_store import run_all_insights
    results = await run(cfg)
    insights = await run_all_insights(results, cfg)
    return results, insights


def _cache(cfg: RunConfig, results: list[ParsedResult]):
    os.makedirs(config.CACHE_DIR, exist_ok=True)
    path = os.path.join(config.CACHE_DIR, f"{cfg.run_id}.json")
    import dataclasses
    with open(path, "w") as f:
        json.dump({
            "run_id": cfg.run_id,
            "config": dataclasses.asdict(cfg),
            "results": [dataclasses.asdict(r) for r in results],
        }, f, indent=2)


def load_cached(run_id: str) -> list[ParsedResult] | None:
    path = os.path.join(config.CACHE_DIR, f"{run_id}.json")
    if not os.path.exists(path):
        return None
    with open(path) as f:
        data = json.load(f)
    results = []
    for r in data["results"]:
        from .models import Mention, Citation
        r["mentions"] = [Mention(**m) for m in r["mentions"]]
        r["citations"] = [Citation(**c) for c in r["citations"]]
        results.append(ParsedResult(**r))
    return results


def list_cached_runs() -> list[dict]:
    if not os.path.exists(config.CACHE_DIR):
        return []
    runs = []
    for fname in sorted(os.listdir(config.CACHE_DIR), reverse=True):
        if fname.endswith(".json"):
            path = os.path.join(config.CACHE_DIR, fname)
            with open(path) as f:
                data = json.load(f)
            cfg = data.get("config", {})
            runs.append({
                "run_id": data["run_id"],
                "target_brand": cfg.get("target_brand", ""),
                "market": cfg.get("market", ""),
                "engines": cfg.get("engines", []),
                "result_count": len(data.get("results", [])),
            })
    return runs
