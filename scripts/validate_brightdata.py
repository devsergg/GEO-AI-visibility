"""
Validation script — make ONE real call to each Bright Data AI scraper.
Run this first, capture raw responses, then update data-contract.md.
"""
import json, os, requests
from dotenv import load_dotenv

load_dotenv()
TOKEN = os.getenv("BRIGHTDATA_API_TOKEN")
BASE  = "https://api.brightdata.com/datasets/v3/scrape"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}

TEST_PROMPT = "What are the best CRM tools for small businesses?"

SCRAPERS = {
    "chatgpt":    "gd_m7aof0k82r803d5bjm",
    # Perplexity dataset_id TBD — try known patterns
    "perplexity": "gd_l1viktl72bvl7bjuj0",  # placeholder — will 404 if wrong
}

def scrape(engine: str, dataset_id: str) -> dict:
    url = f"{BASE}?dataset_id={dataset_id}&format=json"
    payload = [{"url": f"https://{engine}.com/", "prompt": TEST_PROMPT}]
    resp = requests.post(url, headers=HEADERS, json=payload, timeout=120)
    return {
        "status": resp.status_code,
        "engine": engine,
        "dataset_id": dataset_id,
        "raw": resp.json() if resp.headers.get("content-type","").startswith("application/json") else resp.text,
    }

if __name__ == "__main__":
    for engine, did in SCRAPERS.items():
        print(f"\n{'='*60}")
        print(f"Testing: {engine}  (dataset_id={did})")
        result = scrape(engine, did)
        print(f"HTTP {result['status']}")
        print(json.dumps(result["raw"], indent=2)[:2000])  # first 2000 chars
        # save full response
        with open(f"validate_{engine}.json", "w") as f:
            json.dump(result, f, indent=2)
        print(f"→ Saved to validate_{engine}.json")
