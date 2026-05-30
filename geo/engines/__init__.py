from .chatgpt import ChatGPTEngine
from .google_serp import GoogleSerpEngine
from .perplexity import PerplexityEngine
from .gemini import GeminiEngine
from .google_ai_mode import GoogleAiModeEngine
from .base import BaseEngine

ENGINE_REGISTRY: dict[str, type[BaseEngine]] = {
    "chatgpt": ChatGPTEngine,
    "google_serp": GoogleSerpEngine,
    "perplexity": PerplexityEngine,
    "gemini": GeminiEngine,
    "google_ai_mode": GoogleAiModeEngine,
}


def get_engine(name: str) -> BaseEngine:
    cls = ENGINE_REGISTRY.get(name)
    if cls is None:
        raise ValueError(f"Unknown engine: {name!r}. Available: {list(ENGINE_REGISTRY)}")
    return cls()
