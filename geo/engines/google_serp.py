import json
import aiohttp
from urllib.parse import urlparse, quote_plus
from .. import config
from ..models import Prompt
from .base import BaseEngine

_REQUEST_URL = f"{config.BRIGHTDATA_BASE}/request"
_HEADERS = {
    "Authorization": f"Bearer {config.BRIGHTDATA_API_TOKEN}",
    "Content-Type": "application/json",
}


class GoogleSerpEngine(BaseEngine):
    name = "google_serp"

    async def query(self, prompt: Prompt) -> dict:
        google_url = f"https://www.google.com/search?q={quote_plus(prompt.text)}&brd_json=1"
        payload = {
            "zone": config.BRIGHTDATA_ZONE,
            "url": google_url,
            "format": "json",
        }

        async with aiohttp.ClientSession(headers=_HEADERS) as session:
            async with session.post(_REQUEST_URL, json=payload) as resp:
                resp.raise_for_status()
                outer = await resp.json()

        # body is a JSON string
        body_str = outer.get("body", "{}")
        return json.loads(body_str) if isinstance(body_str, str) else body_str

    def extract_text(self, raw: dict) -> str:
        # Prefer AI Overview text; fall back to organic snippets when absent.
        ai_parts = []
        for block in (raw.get("ai_overview") or {}).get("texts", []):
            snippet = block.get("snippet", "")
            if snippet:
                ai_parts.append(snippet)
        if ai_parts:
            return " ".join(ai_parts)

        organic_parts = []
        for result in (raw.get("organic") or []):
            title = result.get("title", "")
            desc = result.get("description", "")
            if title:
                organic_parts.append(title)
            if desc:
                organic_parts.append(desc)
        return " ".join(organic_parts)

    def extract_citations(self, raw: dict) -> list[dict]:
        citations = []
        seen: set[str] = set()

        # AI Overview inline links first
        for block in (raw.get("ai_overview") or {}).get("texts", []):
            for link in block.get("links", []):
                url = link.get("link", "")
                if url and url not in seen:
                    seen.add(url)
                    citations.append({"url": url, "domain": _domain(url)})

        # AI Overview reference links
        for ref in (raw.get("ai_overview") or {}).get("references", []):
            url = ref.get("link", "")
            if url and url not in seen:
                seen.add(url)
                citations.append({"url": url, "domain": _domain(url)})

        # Fall back to organic result URLs when no AI Overview citations
        if not citations:
            for result in (raw.get("organic") or []):
                url = result.get("link", "")
                if url and url not in seen:
                    seen.add(url)
                    citations.append({"url": url, "domain": _domain(url)})

        return citations


def _domain(url: str) -> str:
    try:
        return urlparse(url).netloc.lstrip("www.")
    except Exception:
        return url
