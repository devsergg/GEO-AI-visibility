"""
Company research — given a brand name, use gpt-4o-mini to infer its market
category and top competitors. Called when the user leaves those fields blank.
"""
import json
import openai
from . import config


async def research_company(brand: str) -> dict:
    """Return {"market": str, "competitors": list[str]} for the given brand."""
    client = openai.AsyncOpenAI(api_key=config.OPENAI_API_KEY)
    prompt = (
        f'Research the company or brand "{brand}". '
        "Return a JSON object with exactly two keys:\n"
        '- "market": a concise phrase (10-20 words) describing what market or '
        "category this company operates in\n"
        '- "competitors": a list of 4-6 direct competitor brand names (strings only)\n\n'
        'Example: {"market": "CRM software for small businesses", '
        '"competitors": ["Salesforce", "Pipedrive", "ActiveCampaign", "Zoho CRM"]}'
    )
    resp = await client.chat.completions.create(
        model=config.LLM_MODEL,
        messages=[
            {"role": "system", "content": "You are a market research assistant. Return JSON only, no commentary."},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    data = json.loads(resp.choices[0].message.content)
    return {
        "market": data.get("market", ""),
        "competitors": [str(c) for c in data.get("competitors", [])],
    }
