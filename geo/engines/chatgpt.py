import asyncio, json, time
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


class ChatGPTEngine(BaseEngine):
    name = "chatgpt"

    async def query(self, prompt: Prompt) -> dict:
        payload = {
            "input": [{
                "url": "https://chatgpt.com/",
                "prompt": prompt.text,
                "country": "US",
                "web_search": True,
                "additional_prompt": "",
            }]
        }
        params = {
            "dataset_id": config.CHATGPT_DATASET_ID,
            "notify": "false",
            "include_errors": "true",
        }

        async with aiohttp.ClientSession(headers=_HEADERS) as session:
            # Submit
            async with session.post(_SCRAPE_URL, json=payload, params=params) as resp:
                resp.raise_for_status()
                submit = await resp.json()

            snapshot_id = submit.get("snapshot_id")
            if not snapshot_id:
                # Synchronous result returned directly
                return submit

            # Poll until ready
            for _ in range(config.POLL_MAX_ATTEMPTS):
                await asyncio.sleep(config.POLL_INTERVAL_S)
                async with session.get(f"{_PROGRESS_URL}/{snapshot_id}") as r:
                    status = await r.json()
                if status.get("status") == "ready":
                    break
                if status.get("status") == "failed":
                    raise RuntimeError(f"ChatGPT snapshot failed: {status}")

            # Download
            async with session.get(
                f"{_SNAPSHOT_URL}/{snapshot_id}", params={"format": "json"}
            ) as r:
                records = await r.json()

        return records[0] if isinstance(records, list) else records

    def extract_text(self, raw: dict) -> str:
        return raw.get("answer_text") or raw.get("answer_text_markdown") or ""

    def extract_citations(self, raw: dict) -> list[dict]:
        citations = []
        for src in raw.get("search_sources") or []:
            url = src.get("url", "")
            if url:
                citations.append({"url": url, "domain": _domain(url)})
        for ref in raw.get("references") or []:
            url = ref.get("url", "")
            if url:
                citations.append({"url": url, "domain": _domain(url)})
        # deduplicate by url
        seen = set()
        out = []
        for c in citations:
            if c["url"] not in seen:
                seen.add(c["url"])
                out.append(c)
        return out


def _domain(url: str) -> str:
    try:
        return urlparse(url).netloc.lstrip("www.")
    except Exception:
        return url
