"""
Perplexity engine — requires PERPLEXITY_DATASET_ID in .env.
Same async pattern as ChatGPT engine; Perplexity always includes citations.
"""
import asyncio, json
import aiohttp
from urllib.parse import urlparse
from .. import config
from ..models import Prompt
from .base import BaseEngine

_SCRAPE_URL = f"{config.BRIGHTDATA_BASE}/datasets/v3/trigger"
_PROGRESS_URL = f"{config.BRIGHTDATA_BASE}/datasets/v3/progress"
_SNAPSHOT_URL = f"{config.BRIGHTDATA_BASE}/datasets/v3/snapshot"
_HEADERS = {
    "Authorization": f"Bearer {config.BRIGHTDATA_API_TOKEN}",
    "Content-Type": "application/json",
}


class PerplexityEngine(BaseEngine):
    name = "perplexity"

    def __init__(self):
        if not config.PERPLEXITY_DATASET_ID:
            raise RuntimeError(
                "PERPLEXITY_DATASET_ID not set. Find it in Bright Data dashboard "
                "at /cp/scrapers/gd_xxx and add to .env."
            )

    async def query(self, prompt: Prompt) -> dict:
        payload = {
            "input": [{
                "url": "https://www.perplexity.ai/",
                "prompt": prompt.text,
                "country": "US",
            }]
        }
        params = {
            "dataset_id": config.PERPLEXITY_DATASET_ID,
            "notify": "false",
            "include_errors": "true",
        }

        async with aiohttp.ClientSession(headers=_HEADERS) as session:
            async with session.post(_SCRAPE_URL, json=payload, params=params) as resp:
                resp.raise_for_status()
                submit = await resp.json()

            snapshot_id = submit.get("snapshot_id")
            if not snapshot_id:
                return submit

            for _ in range(config.POLL_MAX_ATTEMPTS):
                await asyncio.sleep(config.POLL_INTERVAL_S)
                async with session.get(f"{_PROGRESS_URL}/{snapshot_id}") as r:
                    status = await r.json()
                if status.get("status") == "ready":
                    break
                if status.get("status") == "failed":
                    raise RuntimeError(f"Perplexity snapshot failed: {status}")

            async with session.get(
                f"{_SNAPSHOT_URL}/{snapshot_id}", params={"format": "json"}
            ) as r:
                records = await r.json()

        return records[0] if isinstance(records, list) else records

    def extract_text(self, raw: dict) -> str:
        return raw.get("answer_text") or raw.get("answer_text_markdown") or ""

    def extract_citations(self, raw: dict) -> list[dict]:
        citations = []
        seen = set()
        for c in raw.get("citations") or []:
            url = c.get("url", "")
            if url and url not in seen:
                seen.add(url)
                citations.append({"url": url, "domain": _domain(url)})
        for src in raw.get("sources") or []:
            url = src.get("url", "")
            if url and url not in seen:
                seen.add(url)
                citations.append({"url": url, "domain": _domain(url)})
        return citations


def _domain(url: str) -> str:
    try:
        return urlparse(url).netloc.lstrip("www.")
    except Exception:
        return url
