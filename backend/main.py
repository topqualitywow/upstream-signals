from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import anthropic
import os
import json
import re
from pytrends.request import TrendReq
import time

# Reddit is optional
try:
    import praw
    REDDIT_ENABLED = bool(os.environ.get("REDDIT_CLIENT_ID") and os.environ.get("REDDIT_CLIENT_SECRET"))
except ImportError:
    REDDIT_ENABLED = False

from supabase import create_client

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://upstream-signals.vercel.app", "http://localhost:5173", "*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

claude = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])

reddit = None
if REDDIT_ENABLED:
    reddit = praw.Reddit(
        client_id=os.environ["REDDIT_CLIENT_ID"],
        client_secret=os.environ["REDDIT_CLIENT_SECRET"],
        user_agent="UpstreamSignalApp/1.0"
    )

# ── Models ─────────────────────────────────────────────────────────────────────

class SignalInput(BaseModel):
    description: str

class Keyword(BaseModel):
    term: str
    cluster: str
    rationale: str
    anchor: bool = False

class KeywordCluster(BaseModel):
    keywords: List[Keyword]

class AnalysisRequest(BaseModel):
    description: str
    keywords: List[Keyword]

# ── Helpers ────────────────────────────────────────────────────────────────────

def parse_json(text: str):
    cleaned = re.sub(r'```json\s*', '', text)
    cleaned = re.sub(r'```\s*', '', cleaned).strip()
    match = re.search(r'(\{[\s\S]*\}|\[[\s\S]*\])', cleaned)
    if match:
        cleaned = match.group(0)
    return json.loads(cleaned)

# ── Step 1: Generate keywords ──────────────────────────────────────────────────

@app.post("/api/generate-keywords")
async def generate_keywords(body: SignalInput):
    try:
        msg = claude.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1500,
            system="""You are an expert at turning freeform cultural observations into optimized keyword clusters for signal analysis.

Given a signal description, generate keywords across 4 clusters:
- core: literal, direct terms closest to the observation (mark 2-3 as anchor:true)
- behavioral: how people search when doing/wanting the thing
- community: how people talk about it in discourse, subcultures, aesthetic labels
- adjacent: things that move with it if the signal is real

Rules:
- Preserve the specific texture and subtlety of the original observation
- Anchor terms should be specific, not broad — they are the canary keywords
- Each keyword needs a rationale explaining what facet of the signal it captures
- Aim for 4-6 keywords per cluster, 16-24 total
- Optimize for machine parsability on Google Trends and Reddit

Return ONLY valid JSON, no markdown:
{
  "keywords": [
    {
      "term": "string",
      "cluster": "core|behavioral|community|adjacent",
      "rationale": "one line why this keyword captures this signal",
      "anchor": true|false
    }
  ]
}""",
            messages=[{"role": "user", "content": body.description}]
        )
        data = parse_json(msg.content[0].text)
        return {"success": True, "keywords": data["keywords"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Step 2: Google Trends ──────────────────────────────────────────────────────

@app.post("/api/trends")
async def get_trends(body: KeywordCluster):
    results = {}
    terms = [k.term for k in body.keywords]
    batches = [terms[i:i+5] for i in range(0, len(terms), 5)]

    try:
        pytrends = TrendReq(hl='en-US', tz=360, timeout=(10, 25))

        for batch in batches[:4]:
            try:
                pytrends.build_payload(batch, timeframe='today 3-m', geo='')
                interest = pytrends.interest_over_time()

                if not interest.empty:
                    for term in batch:
                        if term in interest.columns:
                            series = interest[term].tolist()
                            dates = [str(d)[:10] for d in interest.index.tolist()]
                            avg = sum(series) / len(series) if series else 0
                            recent = sum(series[-4:]) / 4 if len(series) >= 4 else avg
                            older = sum(series[-12:-4]) / 8 if len(series) >= 12 else avg
                            velocity = ((recent - older) / older * 100) if older > 0 else 0
                            results[term] = {
                                "series": series,
                                "dates": dates,
                                "avg": round(avg, 1),
                                "recent_avg": round(recent, 1),
                                "velocity": round(velocity, 1),
                                "status": "ok"
                            }
                        else:
                            results[term] = {"status": "no_data"}
                else:
                    for term in batch:
                        results[term] = {"status": "no_data"}

                time.sleep(1)

            except Exception as e:
                for term in batch:
                    results[term] = {"status": "error", "detail": str(e)}

        return {"success": True, "results": results}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Step 3: Reddit (optional) ──────────────────────────────────────────────────

@app.post("/api/reddit")
async def get_reddit(body: KeywordCluster):
    if not REDDIT_ENABLED or reddit is None:
        return {"success": True, "results": {}, "disabled": True}

    results = {}
    terms = [k.term for k in body.keywords]

    for term in terms[:12]:
        try:
            recent_posts = list(reddit.subreddit("all").search(
                term, sort="new", time_filter="week", limit=25
            ))
            month_posts = list(reddit.subreddit("all").search(
                term, sort="new", time_filter="month", limit=50
            ))

            recent_count = len(recent_posts)
            month_count = len(month_posts)
            older_count = max(0, month_count - recent_count)
            velocity = ((recent_count - older_count) / max(older_count, 1)) * 100

            top_posts = sorted(recent_posts, key=lambda p: p.score, reverse=True)[:3]

            results[term] = {
                "recent_count": recent_count,
                "month_count": month_count,
                "velocity": round(velocity, 1),
                "avg_score": round(sum(p.score for p in recent_posts) / max(recent_count, 1), 1),
                "avg_comments": round(sum(p.num_comments for p in recent_posts) / max(recent_count, 1), 1),
                "top_posts": [
                    {
                        "title": p.title,
                        "subreddit": str(p.subreddit),
                        "score": p.score,
                        "comments": p.num_comments,
                        "url": f"https://reddit.com{p.permalink}"
                    }
                    for p in top_posts
                ],
                "status": "ok"
            }
        except Exception as e:
            results[term] = {"status": "error", "detail": str(e)}

    return {"success": True, "results": results}

# ── Step 4: Analyze ────────────────────────────────────────────────────────────

@app.post("/api/analyze")
async def analyze(body: AnalysisRequest):
    try:
        prompt = f"""You are an upstream signal analyst. Determine if a cultural observation is a real, coherent signal based on correlative evidence across keyword clusters.

ORIGINAL SIGNAL:
{body.description}

KEYWORD CLUSTERS:
{json.dumps([k.dict() for k in body.keywords], indent=2)}

Assess whether the keywords would move together if this signal is real. Return ONLY valid JSON:
{{
  "signal_score": 0,
  "signal_label": "Noise|Weak|Emerging|Building|Strong",
  "correlation_read": "2-3 sentences on whether keywords form a coherent signal cluster",
  "strongest_cluster": "core|behavioral|community|adjacent",
  "strongest_cluster_reason": "why this cluster is most diagnostic",
  "disconnected_keywords": [],
  "anchor_read": "assessment of the anchor/canary keywords specifically",
  "what_to_watch": ["3 specific things that would confirm or deny this signal"],
  "confidence": "low|medium|high",
  "confidence_reason": "one sentence"
}}"""

        msg = claude.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )

        analysis = parse_json(msg.content[0].text)
        return {"success": True, "analysis": analysis}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Save / fetch signals ───────────────────────────────────────────────────────

@app.post("/api/signals")
async def save_signal(body: dict):
    try:
        result = supabase.table("signals").insert({
            "raw_input": body.get("description"),
            "parsed": {"keywords": body.get("keywords")},
            "analysis": body.get("analysis"),
            "trends_data": body.get("trends_data"),
            "reddit_data": body.get("reddit_data"),
        }).execute()
        return {"success": True, "signal": result.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/signals")
async def get_signals():
    try:
        result = supabase.table("signals").select("*").order("created_at", desc=True).execute()
        return {"success": True, "signals": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/signals/{signal_id}")
async def delete_signal(signal_id: str):
    try:
        supabase.table("signals").delete().eq("id", signal_id).execute()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "ok", "reddit": REDDIT_ENABLED}
