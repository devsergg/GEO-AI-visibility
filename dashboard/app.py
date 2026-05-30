"""
GEO Command Center — Streamlit dashboard.
Run with: streamlit run dashboard/app.py
"""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import streamlit as st
import pandas as pd
from geo.models import RunConfig
from geo import pipeline, scorer
from geo.variation import default_variation
from geo import config as geo_config
from geo import cognee_store, sentiment as geo_sentiment, recommender as geo_recommender

st.set_page_config(page_title="GEO Command Center", layout="wide")
st.title("GEO Command Center")
st.caption("AI visibility intelligence — ChatGPT · Google AI Overview · Perplexity · Gemini")

# ── Sidebar: run config ─────────────────────────────────────────────────────
with st.sidebar:
    st.header("Run Configuration")
    target_brand = st.text_input("Target brand", value="HubSpot")
    competitors_raw = st.text_area("Competitors (one per line)", value="Salesforce\nPipedrive\nActiveCampaign\nZoho CRM")
    market = st.text_input("Market / category", value="CRM software for small businesses")
    engines = st.multiselect(
        "Engines",
        ["chatgpt", "google_serp", "perplexity", "gemini"],
        default=["chatgpt", "google_serp"],
    )
    st.divider()
    use_variation = st.toggle(
        "Input-variation engine",
        value=bool(geo_config.OPENAI_API_KEY),
        help="Uses gpt-4o-mini to generate varied prompts across intent × persona × framing axes.",
        disabled=not geo_config.OPENAI_API_KEY,
    )
    if use_variation:
        max_prompts = st.slider("Max prompts", min_value=5, max_value=20, value=10)
    else:
        max_prompts = 5
        st.caption("Fixed 5-prompt set (add OPENAI_API_KEY to enable variation).")
    st.divider()
    run_live = st.button("▶ Run Live Analysis", type="primary", use_container_width=True)
    est = max_prompts * len(engines)
    st.caption(f"~{est} Bright Data request(s) · gpt-4o-mini for variation")

    st.divider()
    st.subheader("Cached Runs")
    cached = pipeline.list_cached_runs()
    if cached:
        run_labels = {r["run_id"]: f"{r['target_brand']} — {r['run_id']}" for r in cached}
        selected_run_id = st.selectbox("Load cached run", options=list(run_labels.keys()),
                                        format_func=lambda k: run_labels[k])
        load_cache = st.button("Load", use_container_width=True)
    else:
        st.info("No cached runs yet.")
        load_cache = False
        selected_run_id = None

# ── State ───────────────────────────────────────────────────────────────────
if "results" not in st.session_state:
    st.session_state.results = None
if "run_cfg" not in st.session_state:
    st.session_state.run_cfg = None
if "insights" not in st.session_state:
    st.session_state.insights = None
if "insights_run_id" not in st.session_state:
    st.session_state.insights_run_id = None
if "sentiment" not in st.session_state:
    st.session_state.sentiment = None
if "recommendations" not in st.session_state:
    st.session_state.recommendations = None
if "draft_artifact" not in st.session_state:
    st.session_state.draft_artifact = None

# ── Live run ────────────────────────────────────────────────────────────────
if run_live:
    competitors = [c.strip() for c in competitors_raw.splitlines() if c.strip()]
    variation_cfg = None
    if use_variation and geo_config.OPENAI_API_KEY:
        variation_cfg = default_variation(market)
        variation_cfg.max_prompts = max_prompts
    cfg = RunConfig(
        target_brand=target_brand,
        competitors=competitors,
        market=market,
        engines=engines,
        variation=variation_cfg,
    )
    with st.spinner(f"Running {len(engines)} engine(s) × 5 prompts…"):
        results = asyncio.run(pipeline.run(cfg))
    st.session_state.results = results
    st.session_state.run_cfg = cfg
    st.session_state.insights = None
    st.session_state.sentiment = None
    st.session_state.recommendations = None
    st.session_state.draft_artifact = None
    st.success(f"Done — {len(results)} results collected and cached.")

# ── Load cached ─────────────────────────────────────────────────────────────
if load_cache and selected_run_id:
    results = pipeline.load_cached(selected_run_id)
    if results:
        meta = next((r for r in cached if r["run_id"] == selected_run_id), {})
        cfg = RunConfig(
            target_brand=meta.get("target_brand", target_brand),
            competitors=[c.strip() for c in competitors_raw.splitlines() if c.strip()],
            market=meta.get("market", market),
            engines=meta.get("engines", engines),
            run_id=selected_run_id,
        )
        st.session_state.results = results
        st.session_state.run_cfg = cfg
        st.session_state.insights = None
        st.session_state.sentiment = None
        st.session_state.recommendations = None
        st.session_state.draft_artifact = None
        st.success(f"Loaded {len(results)} cached results.")
    else:
        st.error("Could not load cached run.")

# ── Dashboard ────────────────────────────────────────────────────────────────
results = st.session_state.results
cfg = st.session_state.run_cfg

if results is None:
    st.info("Configure a run in the sidebar and click **Run Live Analysis**, or load a cached run.")
    st.stop()

competitors = cfg.competitors
prompts_meta = {}
for r in results:
    prompts_meta[r.prompt_id] = {"intent": "product_discovery", "persona": "general_buyer"}

score_result = scorer.score(cfg.run_id, cfg.target_brand, competitors, results, prompts_meta)
gap_list = scorer.citation_gap(cfg.target_brand, results)

# ── Score header ─────────────────────────────────────────────────────────────
responded = [r for r in results if r.responded]
failed = [r for r in results if not r.responded]

col1, col2, col3, col4 = st.columns(4)
col1.metric("Visibility Score", f"{score_result.visibility_score}/100")
col2.metric("Mention Rate", f"{score_result.mention_rate:.0%}")
col3.metric("Responses Collected", len(responded))
col4.metric("Failed / Skipped", len(failed))

if failed:
    with st.expander(f"⚠ {len(failed)} failed responses"):
        for r in failed:
            st.write(f"- `{r.engine}` / `{r.prompt_id}`: {r.error}")

st.divider()

# ── Score formula transparency ────────────────────────────────────────────────
with st.expander("Score components (formula)"):
    comp = score_result.components
    st.markdown(
        f"**Formula:** `visibility_score = (mention_rate × 0.7 + position_score × 0.3) × 100`\n\n"
        f"| Component | Value |\n|---|---|\n"
        f"| Responses with target mentioned | {comp.get('mention_count')} / {comp.get('total_responses')} |\n"
        f"| Mention rate | {comp.get('mention_rate', 0):.1%} |\n"
        f"| Avg position when mentioned | {comp.get('avg_position') or 'N/A'} |\n"
        f"| Position score (0–1) | {comp.get('position_score', 0):.3f} |\n"
    )

# ── Segment breakdowns ────────────────────────────────────────────────────────
col_a, col_b, col_c = st.columns(3)

with col_a:
    st.subheader("By Engine")
    if score_result.by_engine:
        df = pd.DataFrame(score_result.by_engine.items(), columns=["Engine", "Score"])
        st.bar_chart(df.set_index("Engine"))
    else:
        st.caption("No data")

with col_b:
    st.subheader("By Intent")
    if score_result.by_intent:
        df = pd.DataFrame(score_result.by_intent.items(), columns=["Intent", "Score"])
        st.bar_chart(df.set_index("Intent"))
    else:
        st.caption("No data")

with col_c:
    st.subheader("By Persona")
    if score_result.by_persona:
        df = pd.DataFrame(score_result.by_persona.items(), columns=["Persona", "Score"])
        st.bar_chart(df.set_index("Persona"))
    else:
        st.caption("No data")

st.divider()

# ── Per-response mention table ────────────────────────────────────────────────
st.subheader("Per-Response Mention Table")
all_brands = [cfg.target_brand] + competitors
rows = []
for r in responded:
    mentioned = {m.brand.lower() for m in r.mentions}
    row = {"Engine": r.engine, "Prompt": r.prompt_text[:60] + "…"}
    for brand in all_brands:
        m = next((m for m in r.mentions if m.brand.lower() == brand.lower()), None)
        if m:
            row[brand] = f"#{m.position}{'★' if m.is_recommendation else ''}"
        else:
            row[brand] = "—"
    rows.append(row)

if rows:
    df = pd.DataFrame(rows)
    st.dataframe(df, use_container_width=True, hide_index=True)

st.divider()

# ── Citation-gap list ─────────────────────────────────────────────────────────
st.subheader("Citation-Gap Analysis — Centrality-Ranked Sources")
st.caption(
    "Sources cited when competitors were recommended but **your brand was absent**. "
    "Higher centrality = source moves more queries."
)

if gap_list:
    gap_rows = []
    for g in gap_list:
        gap_rows.append({
            "Domain": g.domain,
            "Centrality": g.centrality_score,
            "Competitors citing": ", ".join(g.reaching_competitors),
            "Engines": ", ".join(g.reaching_engines),
            "Example URL": g.urls[0] if g.urls else "",
        })
    df_gap = pd.DataFrame(gap_rows)
    st.dataframe(df_gap, use_container_width=True, hide_index=True)
else:
    st.success(f"No citation gaps found — **{cfg.target_brand}** was mentioned in every response that had citations.")

st.divider()

# ── Graph Insights (Cognee) ───────────────────────────────────────────────────
st.subheader("Graph Insights")
st.caption(
    "Semantic analysis powered by the Cognee knowledge graph. "
    "Ingests all responses, then queries for consideration-set, gaps, centrality, and sentiment."
)

already_ingested = st.session_state.insights_run_id == cfg.run_id
run_insights = st.button("Run Graph Analysis", type="secondary")
if run_insights:
    if already_ingested and st.session_state.insights:
        # Ingest already done for this run — only re-run the recall queries (~15s)
        with st.spinner("Re-running graph queries… (~15s)"):
            st.session_state.insights = asyncio.run(
                cognee_store.recall_all(cfg.run_id, cfg.target_brand)
            )
    else:
        with st.spinner("Ingesting responses into knowledge graph and running queries… (~45s)"):
            st.session_state.insights = asyncio.run(
                cognee_store.run_all_insights(responded, cfg)
            )
        st.session_state.insights_run_id = cfg.run_id

insights = st.session_state.insights
if insights:
    ic1, ic2 = st.columns(2)
    with ic1:
        st.markdown("**Consideration Set**")
        st.info(insights.get("consideration_set", "—"))
    with ic2:
        st.markdown("**Absence Explanation**")
        st.info(insights.get("absence_explanation", "—"))

    ic3, ic4 = st.columns(2)
    with ic3:
        st.markdown("**Source Centrality**")
        st.info(insights.get("centrality_narrative", "—"))
    with ic4:
        st.markdown("**Sentiment & Sources**")
        st.info(insights.get("sentiment_sources", "—"))

    st.markdown("**Segment Gaps**")
    st.info(insights.get("segment_gaps", "—"))
elif not run_insights:
    st.caption("Click **Run Graph Analysis** to generate insights for this run.")

st.divider()

# ── Sentiment Breakdown ───────────────────────────────────────────────────────
st.subheader("Sentiment Breakdown")
st.caption(
    "Per-brand, per-engine polarity and positioning trait, traced to the citation "
    "domains that appeared alongside each brand's mentions."
)

_POLARITY_BADGE = {
    "positive": "🟢 Positive",
    "neutral":  "⚪ Neutral",
    "negative": "🔴 Negative",
    "mixed":    "🟡 Mixed",
}

run_sentiment = st.button("Run Sentiment Analysis", type="secondary")
if run_sentiment:
    with st.spinner("Extracting sentiment per brand per engine… (~10s)"):
        st.session_state.sentiment = asyncio.run(
            geo_sentiment.analyze(responded, cfg)
        )

sentiments = st.session_state.sentiment
if sentiments:
    sent_rows = [
        {
            "Brand": s.brand,
            "Engine": s.engine,
            "Polarity": _POLARITY_BADGE.get(s.polarity, s.polarity),
            "Trait": s.trait,
            "Key Sources": ", ".join(s.source_domains[:4]) or "—",
        }
        for s in sentiments
    ]
    df_sent = pd.DataFrame(sent_rows)
    st.dataframe(df_sent, use_container_width=True, hide_index=True)
elif not run_sentiment:
    st.caption("Click **Run Sentiment Analysis** to extract polarity and positioning per brand.")

st.divider()

# ── Recommendations ───────────────────────────────────────────────────────────
st.subheader("Recommendations")
st.caption(
    "Grounded in this run's citation gaps, sentiment findings, and segment data. "
    "Run Sentiment Analysis first for richer recommendations."
)

_PRIORITY_BADGE = {"high": "🔴 High", "medium": "🟡 Medium", "low": "⚪ Low"}

run_recs = st.button("Generate Recommendations", type="primary")
if run_recs:
    segment_gaps = (st.session_state.insights or {}).get("segment_gaps", "")
    with st.spinner("Generating grounded recommendations… (~10s)"):
        recs, artifact = asyncio.run(
            geo_recommender.recommend(
                cfg=cfg,
                score_result=score_result,
                gap_list=gap_list,
                sentiments=st.session_state.sentiment,
                segment_gaps_narrative=segment_gaps,
            )
        )
    st.session_state.recommendations = recs
    st.session_state.draft_artifact = artifact

recs = st.session_state.recommendations
artifact = st.session_state.draft_artifact

if recs:
    for rec in recs:
        badge = _PRIORITY_BADGE.get(rec.priority, rec.priority)
        src = f" · `{rec.target_source}`" if rec.target_source else ""
        with st.container(border=True):
            st.markdown(f"**{rec.title}** &nbsp; {badge}{src}")
            st.markdown(f"**Why:** {rec.rationale}")
            st.markdown(f"**Action:** {rec.action}")

    if artifact:
        with st.expander(f"Draft artifact — {artifact.artifact_type.replace('_', ' ').title()}: *{artifact.title}*"):
            st.markdown(artifact.content)
elif not run_recs:
    st.caption("Click **Generate Recommendations** to get data-grounded action items.")

st.divider()

# ── Raw responses (debug) ────────────────────────────────────────────────────
with st.expander("Raw responses"):
    for r in responded:
        st.markdown(f"**{r.engine} / {r.prompt_id}** — `{r.prompt_text[:80]}`")
        st.text(r.raw_text[:600] + ("…" if len(r.raw_text) > 600 else ""))
        if r.citations:
            st.write("Citations:", [c.url for c in r.citations[:5]])
        st.divider()
