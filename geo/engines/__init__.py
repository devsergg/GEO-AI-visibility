from .chatgpt import ChatGPTEngine
from .google_serp import GoogleSerpEngine
from .perplexity import PerplexityEngine
from .base import BaseEngine

ENGINE_REGISTRY: dict[str, type[BaseEngine]] = {
    "chatgpt": ChatGPTEngine,
    "google_serp": GoogleSerpEngine,
    "perplexity": PerplexityEngine,
}


def get_engine(name: str) -> BaseEngine:
    cls = ENGINE_REGISTRY.get(name)
    if cls is None:
        raise ValueError(f"Unknown engine: {name!r}. Available: {list(ENGINE_REGISTRY)}")
    return cls()
