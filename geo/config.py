import os
from dotenv import load_dotenv

load_dotenv()

BRIGHTDATA_API_TOKEN: str = os.environ["BRIGHTDATA_API_TOKEN"]
BRIGHTDATA_ZONE: str = os.getenv("BRIGHTDATA_ZONE", "mcp_unlocker")
ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
AIML_API_KEY: str = os.getenv("AIML_API_KEY", "")
OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

# Cost-efficient model for variation generation, sentiment, recommendations
LLM_MODEL = "gpt-4o-mini"

# Bright Data dataset IDs — verified 2026-05-28
CHATGPT_DATASET_ID = "gd_m7aof0k82r803d5bjm"
PERPLEXITY_DATASET_ID = os.getenv("PERPLEXITY_DATASET_ID", "")  # set once found

BRIGHTDATA_BASE = "https://api.brightdata.com"
POLL_INTERVAL_S = 8
POLL_MAX_ATTEMPTS = 30  # ~4 minutes max wait

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "cache")
