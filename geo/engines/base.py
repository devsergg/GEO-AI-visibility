from abc import ABC, abstractmethod
from ..models import Prompt


class BaseEngine(ABC):
    name: str

    @abstractmethod
    async def query(self, prompt: Prompt) -> dict:
        """Submit a prompt and return the raw engine response dict."""

    @abstractmethod
    def extract_text(self, raw: dict) -> str:
        """Pull plain answer text from a raw response."""

    @abstractmethod
    def extract_citations(self, raw: dict) -> list[dict]:
        """Return list of {url, domain} dicts from a raw response."""
