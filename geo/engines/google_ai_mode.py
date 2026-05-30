"""
Google AI Mode Search engine via Bright Data scraper (dataset gd_mcswdt6z2elth3zqr2).
Endpoint: /scrape (async — returns 202, poll progress, download when ready).
Response shape validated 2026-05-29. Avg latency ~5 min.
"""
import asyncio
import aiohttp
from urllib.parse import urlparse
from .. import config
from ..models import Prompt
from .base import BaseEngine

_SCRAPE_URL = f"{config.BRIGHTDATA_BASE}/datasets/v3/scrape"
_PROGRESS_URL = f"{config.BRIGHTDATA_BASE}/datasets/v3/progress"
_SNAPSHOT_URL = f"{config.BRIGHTDATA_BASE}/datasets/v3/snapshot"
_HEADERS = {
    "Authorization": f"Bearer {config.BRIGHTDATA_API_TOKEN}",
    "Content-Type": "application/json",
}

# This scraper can take ~5 min — override global poll limit
_POLL_ATTEMPTS = 50      # 50 × 8s = ~6.7 min max
_POLL_INTERVAL = 8


class GoogleAiModeEngine(BaseEngine):
    name = "google_ai_mode"

    def __init__(self):
        if not config.GOOGLE_AI_MODE_DATASET_ID:
            raise RuntimeError(
                "GOOGLE_AI_MODE_DATASET_ID not set. Add to .env — dataset ID: gd_mcswdt6z2elth3zqr2"
            )

    async def query(self, prompt: Prompt) -> dict:
        payload = {
            "input": [{
                "url": "https://google.com/aimode",
                "prompt": prompt.text,
                "country": "",
            }]
        }
        params = {
            "dataset_id": config.GOOGLE_AI_MODE_DATASET_ID,
            "notify": "false",
            "include_errors": "true",
        }

        async with aiohttp.ClientSession(headers=_HEADERS) as session:
            async with session.post(_SCRAPE_URL, json=payload, params=params) as resp:
                resp.raise_for_status()
                submit = await resp.json()

            submit = submit[0] if isinstance(submit, list) else submit
            snapshot_id = submit.get("snapshot_id")

            if not snapshot_id:
                return submit

            for _ in range(_POLL_ATTEMPTS):
                await asyncio.sleep(_POLL_INTERVAL)
                async with session.get(f"{_PROGRESS_URL}/{snapshot_id}") as r:
                    status = await r.json()
                if status.get("status") == "ready":
                    break
                if status.get("status") == "failed":
                    raise RuntimeError(f"Google AI Mode snapshot failed: {status}")

            async with session.get(
                f"{_SNAPSHOT_URL}/{snapshot_id}", params={"format": "json"}
            ) as r:
                records = await r.json()

        return records[0] if isinstance(records, list) else records

    def extract_text(self, raw: dict) -> str:
        return raw.get("answer_text") or raw.get("answer_text_markdown") or ""

    def extract_citations(self, raw: dict) -> list[dict]:
        seen = set()
        out = []
        for c in raw.get("citations") or []:
            url = c.get("url", "")
            if url and url not in seen:
                seen.add(url)
                # domain field comes as full URL ("https://reddit.com") — parse it
                raw_domain = c.get("domain", "")
                domain = _domain(raw_domain) if raw_domain else _domain(url)
                out.append({"url": url, "domain": domain})
        for link in raw.get("links_attached") or []:
            url = link.get("url", "") if isinstance(link, dict) else str(link)
            if url and url not in seen:
                seen.add(url)
                out.append({"url": url, "domain": _domain(url)})
        return out


def _domain(url: str) -> str:
    try:
        return urlparse(url).netloc.lstrip("www.")
    except Exception:
        return url
