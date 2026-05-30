"""
Quick integration test for geo/cognee_store.py.
Tests ingest + all 5 recall queries with a synthetic GEO payload.
Run: python scripts/test_cognee_store.py
"""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()

import cognee
from geo.models import RunConfig, ParsedResult, Mention, Citation
from geo.cognee_store import ingest, run_all_insights

TARGET = "Acme PM"
RUN_ID = "test_cognee_001"

FAKE_RESULTS = [
    ParsedResult(
        run_id=RUN_ID, prompt_id="p01",
        prompt_text="What is the best project management tool for a startup?",
        engine="chatgpt",
        raw_text="Notion and Linear are the top picks. Acme PM was not mentioned.",
        timestamp="2026-05-29T12:00:00Z",
        mentions=[
            Mention(brand="Notion",  position=1, is_recommendation=True),
            Mention(brand="Linear",  position=2, is_recommendation=True),
        ],
        citations=[
            Citation(domain="techradar.com",    url="https://techradar.com/best-pm-tools"),
            Citation(domain="producthunt.com",  url="https://producthunt.com/posts/linear"),
        ],
        responded=True,
    ),
    ParsedResult(
        run_id=RUN_ID, prompt_id="p02",
        prompt_text="Which PM tool do enterprises prefer?",
        engine="google_serp",
        raw_text="Asana dominates the enterprise segment. Acme PM is mentioned as a niche option.",
        timestamp="2026-05-29T12:01:00Z",
        mentions=[
            Mention(brand="Asana",   position=1, is_recommendation=True),
            Mention(brand="Acme PM", position=2, is_recommendation=False),
        ],
        citations=[
            Citation(domain="g2.com",    url="https://g2.com/categories/project-management"),
            Citation(domain="gartner.com", url="https://gartner.com/pm-quadrant"),
        ],
        responded=True,
    ),
    ParsedResult(
        run_id=RUN_ID, prompt_id="p03",
        prompt_text="Affordable project management for freelancers?",
        engine="perplexity",
        raw_text="Trello and Notion are recommended for budget-conscious freelancers.",
        timestamp="2026-05-29T12:02:00Z",
        mentions=[
            Mention(brand="Trello", position=1, is_recommendation=True),
            Mention(brand="Notion", position=2, is_recommendation=True),
        ],
        citations=[
            Citation(domain="techradar.com", url="https://techradar.com/freelance-tools"),
            Citation(domain="theverge.com",  url="https://theverge.com/trello-review"),
        ],
        responded=True,
    ),
]

CFG = RunConfig(
    target_brand=TARGET,
    competitors=["Notion", "Linear", "Asana", "Trello"],
    market="project management software",
    engines=["chatgpt", "google_serp", "perplexity"],
    run_id=RUN_ID,
)


async def main():
    print("=== cognee_store integration test ===\n")

    print("[0] Resetting Cognee state...")
    await cognee.forget(everything=True)
    print("    done.\n")

    print("[1] Testing ingest()...")
    await ingest(FAKE_RESULTS, CFG)
    print("    done.\n")

    print("[2] Testing run_all_insights() recall queries...\n")
    # Re-ingest is a no-op since data is already in — just run the recalls
    from geo.cognee_store import (
        recall_consideration_set, recall_absence_explanation,
        recall_centrality_narrative, recall_sentiment_sources,
        recall_segment_gaps,
    )

    queries = [
        ("consideration_set",    recall_consideration_set(RUN_ID, TARGET)),
        ("absence_explanation",  recall_absence_explanation(RUN_ID, TARGET)),
        ("centrality_narrative", recall_centrality_narrative(RUN_ID, TARGET)),
        ("sentiment_sources",    recall_sentiment_sources(RUN_ID, TARGET)),
        ("segment_gaps",         recall_segment_gaps(RUN_ID, TARGET)),
    ]

    for name, coro in queries:
        print(f"  [{name}]")
        try:
            result = await coro
            print(f"    {result[:400]}")
        except Exception as e:
            print(f"    ERROR: {type(e).__name__}: {e}")
        print()

    print("=== test complete ===")


if __name__ == "__main__":
    asyncio.run(main())
