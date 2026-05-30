"""
Gemini engine via Bright Data scraper (dataset gd_mbz66arm2mf9cu856y).
Endpoint: /scrape (synchronous — no polling needed).
Response shape validated 2026-05-29.
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


class GeminiEngine(BaseEngine):
    name = "gemini"

    def __init__(self):
        if not config.GEMINI_DATASET_ID:
            raise RuntimeError(
                "GEMINI_DATASET_ID not set. Add to .env — dataset ID: gd_mbz66arm2mf9cu856y"
            )

    async def query(self, prompt: Prompt) -> dict:
        payload = {
            "input": [{
                "url": "https://gemini.google.com/",
                "prompt": prompt.text,
                "index": 1,
            }]
        }
        params = {
            "dataset_id": config.GEMINI_DATASET_ID,
            "notify": "false",
            "include_errors": "true",
        }

        async with aiohttp.ClientSession(headers=_HEADERS) as session:
            async with session.post(_SCRAPE_URL, json=payload, params=params) as resp:
                resp.raise_for_status()
                result = await resp.json()

            # Gemini returns synchronously but handle async snapshot just in case
            submit = result[0] if isinstance(result, list) else result
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
                    raise RuntimeError(f"Gemini snapshot failed: {status}")

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
                out.append({"url": url, "domain": _domain(url)})
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
