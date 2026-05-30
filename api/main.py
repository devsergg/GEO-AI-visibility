"""
GEO Command Center — FastAPI backend.
Wraps the geo Python package for consumption by the Next.js frontend.

Run with:
  uvicorn api.main:app --reload --port 8000
"""
import sys
import os
import json
import dataclasses

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from geo.models import RunConfig, VariationConfig, ParsedResult, BrandSentiment
from geo import pipeline, scorer
from geo import company_research
from geo.variation import generate_variation_config
from geo import sentiment as geo_sentiment
from geo import recommender as geo_recommender
from geo import config as geo_config

app = FastAPI(title="GEO Command Center API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request models ───────────────────────────────────────────────────────────

class ResearchRequest(BaseModel):
    brand: str


class RunRequest(BaseModel):
    brand: str
    competitors: list[str]
    market: str
    engines: list[str] = ["chatgpt", "google_serp", "perplexity", "gemini"]
    use_variation: bool = True
    max_prompts: int = 10


class RecommendationsRequest(BaseModel):
    sentiments: Optional[list[dict]] = None


# ── Helpers ──────────────────────────────────────────────────────────────────

def _load_cached_config(run_id: str) -> dict:
    path = os.path.join(geo_config.CACHE_DIR, f"{run_id}.json")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    with open(path) as f:
        return json.load(f)


def _cfg_from_cache(run_id: str) -> tuple[RunConfig, list[ParsedResult]]:
    data = _load_cached_config(run_id)
    raw_cfg = data["config"]
    results = pipeline.load_cached(run_id)
    if results is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id} results missing")
    cfg = RunConfig(
        target_brand=raw_cfg["target_brand"],
        competitors=raw_cfg["competitors"],
        market=raw_cfg["market"],
        engines=raw_cfg["engines"],
        run_id=run_id,
    )
    return cfg, results


def _build_run_data(run_id: str, cfg: RunConfig, results: list[ParsedResult]) -> dict:
    prompts_meta = {
        r.prompt_id: {"intent": "product_discovery", "persona": "general_buyer"}
        for r in results
    }
    score_result = scorer.score(
        run_id, cfg.target_brand, cfg.competitors, results, prompts_meta
    )
    gap_list = scorer.citation_gap(cfg.target_brand, results)
    responded = [r for r in results if r.responded]
    failed = [r for r in results if not r.responded]
    return {
        "run_id": run_id,
        "config": dataclasses.asdict(cfg),
        "score": dataclasses.asdict(score_result),
        "gap_list": [dataclasses.asdict(g) for g in gap_list],
        "results": [dataclasses.asdict(r) for r in results],
        "responded_count": len(responded),
        "failed_count": len(failed),
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "openai_ready": bool(geo_config.OPENAI_API_KEY)}


@app.post("/api/research")
async def research_company(req: ResearchRequest):
    if not req.brand.strip():
        raise HTTPException(status_code=400, detail="Brand name required")
    if not geo_config.OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY not configured")
    try:
        result = await company_research.research_company(req.brand.strip())
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/run")
async def run_analysis(req: RunRequest):
    if not req.brand.strip():
        raise HTTPException(status_code=400, detail="Brand name required")
    try:
        variation_cfg: Optional[VariationConfig] = None
        if req.use_variation and geo_config.OPENAI_API_KEY:
            variation_cfg = generate_variation_config(req.market, req.brand)
            variation_cfg.max_prompts = req.max_prompts

        cfg = RunConfig(
            target_brand=req.brand.strip(),
            competitors=req.competitors,
            market=req.market,
            engines=req.engines,
            variation=variation_cfg,
        )
        results = await pipeline.run(cfg)
        return _build_run_data(cfg.run_id, cfg, results)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/runs")
def list_runs():
    return pipeline.list_cached_runs()


@app.get("/api/runs/{run_id}")
def get_run(run_id: str):
    cfg, results = _cfg_from_cache(run_id)
    return _build_run_data(run_id, cfg, results)


@app.post("/api/runs/{run_id}/sentiment")
async def run_sentiment(run_id: str):
    cfg, results = _cfg_from_cache(run_id)
    if not geo_config.OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY not configured")
    responded = [r for r in results if r.responded]
    sentiments = await geo_sentiment.analyze(responded, cfg)
    return [dataclasses.asdict(s) for s in sentiments]


@app.post("/api/runs/{run_id}/recommendations")
async def run_recommendations(run_id: str, req: RecommendationsRequest = None):
    cfg, results = _cfg_from_cache(run_id)
    if not geo_config.OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY not configured")

    prompts_meta = {
        r.prompt_id: {"intent": "product_discovery", "persona": "general_buyer"}
        for r in results
    }
    score_result = scorer.score(
        run_id, cfg.target_brand, cfg.competitors, results, prompts_meta
    )
    gap_list = scorer.citation_gap(cfg.target_brand, results)

    sentiments: Optional[list[BrandSentiment]] = None
    if req and req.sentiments:
        sentiments = [BrandSentiment(**s) for s in req.sentiments]

    recs, artifact = await geo_recommender.recommend(
        cfg=cfg,
        score_result=score_result,
        gap_list=gap_list,
        sentiments=sentiments,
        segment_gaps_narrative="",
    )
    return {
        "recommendations": [dataclasses.asdict(r) for r in recs],
        "artifact": dataclasses.asdict(artifact) if artifact else None,
    }


@app.post("/api/runs/{run_id}/insights")
async def run_insights(run_id: str):
    cfg, results = _cfg_from_cache(run_id)
    from geo import cognee_store
    responded = [r for r in results if r.responded]
    try:
        insights = await cognee_store.run_all_insights(responded, cfg)
        return insights
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
