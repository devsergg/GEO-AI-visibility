"""
Cognee validation script — CLAUDE.md golden rule: make one real call, capture
the raw output, correct graph-schema.md before building the pipeline on top.

Feeds a minimal GEO-shaped payload (one Response with Brand mentions, Citations,
and a Prompt) and then queries back to confirm the graph is queryable.
Run with: python scripts/validate_cognee.py
"""
import asyncio, json, os, textwrap
from dotenv import load_dotenv

load_dotenv()

import cognee


async def main():
    print("=== Cognee validation — GEO Command Center ===\n")

    # ── 1. Reset state so we start clean ──────────────────────────────────────
    print("[1] Forgetting previous state...")
    await cognee.forget(everything=True)
    print("    done.\n")

    # ── 2. Ingest a GEO-shaped payload ────────────────────────────────────────
    # Mimics what the real pipeline will write: one engine response with brand
    # mentions and citations, tagged by intent/persona/engine/run.
    payload = textwrap.dedent("""
        GEO RUN RESULT
        run_id: validate_001
        engine: chatgpt
        prompt_intent: find_best_tool
        prompt_persona: startup_founder
        prompt_text: What is the best project management tool for a small startup?

        ANSWER:
        For small startups, Notion is frequently recommended for its flexibility.
        Linear is also mentioned as the top choice for engineering teams.
        Asana appears as a strong option for cross-functional teams.
        The target brand Acme PM was not mentioned in this response.

        CITATIONS:
        - https://techradar.com/best-project-management-tools
        - https://theverge.com/project-management-reviews
        - https://producthunt.com/posts/linear

        BRANDS MENTIONED: Notion (position 1, recommendation), Linear (position 2, recommendation), Asana (position 3, recommendation)
        TARGET BRAND MENTIONED: No
    """).strip()

    print("[2] Ingesting GEO-shaped payload via remember()...")
    await cognee.remember(payload)
    print("    done.\n")

    # ── 3. Query back ──────────────────────────────────────────────────────────
    queries = [
        "Which project management brands were recommended?",
        "What sources were cited?",
        "Was the target brand Acme PM mentioned?",
        "What was the prompt intent and persona?",
    ]

    print("[3] Running recall queries...\n")
    for q in queries:
        print(f"  Q: {q}")
        try:
            results = await cognee.recall(query_text=q)
            if results:
                for r in results[:3]:  # cap output
                    text = getattr(r, "text", None) or getattr(r, "content", None) or str(r)
                    print(f"    → {text[:300]}")
            else:
                print("    → (no results)")
        except Exception as e:
            print(f"    → ERROR: {e}")
        print()

    # ── 4. Inspect raw graph nodes ─────────────────────────────────────────────
    print("[4] Inspecting raw graph state...")
    try:
        import cognee.infrastructure.databases.graph as graph_mod
        print(f"    graph module path: {graph_mod.__file__}")
    except Exception as e:
        print(f"    graph introspection: {e}")

    # Try to get the graph engine directly
    try:
        from cognee.infrastructure.databases.graph import get_graph_engine
        graph = await get_graph_engine()
        nodes = await graph.get_all_nodes()
        print(f"\n    Total nodes in graph: {len(nodes)}")
        print(f"    Sample node types: {list({type(n).__name__ for n in nodes[:20]})}")
        if nodes:
            sample = nodes[0]
            print(f"\n    First node raw repr:\n    {repr(sample)[:800]}")
    except Exception as e:
        print(f"    graph node inspection failed: {e}")
        print("    (this is OK — captures what's available)")

    print("\n=== Validation complete ===")
    print("Update graph-schema.md based on the output above before building geo/cognee_store.py")


if __name__ == "__main__":
    asyncio.run(main())
