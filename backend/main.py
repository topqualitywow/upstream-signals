from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import anthropic
import os
import json
import re
from pytrends.request import TrendReq
import time
import math
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("upstream")

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
    trends_data: Optional[Dict] = None
    reddit_data: Optional[Dict] = None

# ── Helpers ────────────────────────────────────────────────────────────────────

def parse_json(text: str):
    cleaned = re.sub(r'```json\s*', '', text)
    cleaned = re.sub(r'```\s*', '', cleaned).strip()
    match = re.search(r'(\{[\s\S]*\}|\[[\s\S]*\])', cleaned)
    if match:
        cleaned = match.group(0)
    return json.loads(cleaned)

def pearson_correlation(x: list, y: list) -> float:
    """Calculate Pearson correlation coefficient between two series."""
    n = min(len(x), len(y))
    if n < 3:
        return 0.0
    x = x[:n]
    y = y[:n]
    mean_x = sum(x) / n
    mean_y = sum(y) / n
    numerator = sum((x[i] - mean_x) * (y[i] - mean_y) for i in range(n))
    denom_x = math.sqrt(sum((v - mean_x) ** 2 for v in x))
    denom_y = math.sqrt(sum((v - mean_y) ** 2 for v in y))
    if denom_x == 0 or denom_y == 0:
        return 0.0
    return round(numerator / (denom_x * denom_y), 3)

def compute_correlation_matrix(trends_data: dict, keywords: list) -> dict:
    """Compute pairwise Pearson correlations across all keyword series."""
    valid = [(k.term, k.cluster, trends_data[k.term]["series"])
             for k in keywords
             if k.term in trends_data and trends_data[k.term].get("status") == "ok"]

    if len(valid) < 2:
        return {"pairs": [], "cluster_scores": {}, "overall_score": None, "coverage": len(valid)}

    pairs = []
    for i in range(len(valid)):
        for j in range(i + 1, len(valid)):
            term_a, cluster_a, series_a = valid[i]
            term_b, cluster_b, series_b = valid[j]
            r = pearson_correlation(series_a, series_b)
            pairs.append({
                "term_a": term_a,
                "term_b": term_b,
                "cluster_a": cluster_a,
                "cluster_b": cluster_b,
                "r": r
            })

    # Average correlation by cluster pair
    cluster_scores = {}
    cluster_pairs = {}
    for p in pairs:
        key = tuple(sorted([p["cluster_a"], p["cluster_b"]]))
        if key not in cluster_pairs:
            cluster_pairs[key] = []
        cluster_pairs[key].append(p["r"])

    for key, vals in cluster_pairs.items():
        cluster_scores[f"{key[0]}_{key[1]}"] = round(sum(vals) / len(vals), 3)

    overall = round(sum(p["r"] for p in pairs) / len(pairs), 3) if pairs else None

    return {
        "pairs": pairs,
        "cluster_scores": cluster_scores,
        "overall_score": overall,
        "coverage": len(valid),
        "total_keywords": len(keywords)
    }

def compute_signal_score(trends_data: dict, reddit_data: dict, keywords: list, correlation: dict) -> dict:
    """Compute a data-driven signal score from actual metrics."""
    components = {}

    # 1. Trends velocity score (avg velocity of keywords with data, normalized 0-100)
    velocities = [
        trends_data[k.term]["velocity"]
        for k in keywords
        if k.term in trends_data and trends_data[k.term].get("status") == "ok"
    ]
    if velocities:
        avg_velocity = sum(velocities) / len(velocities)
        # Normalize: -50 to +50 maps to 0-100
        velocity_score = max(0, min(100, 50 + avg_velocity))
        components["trends_velocity"] = round(velocity_score, 1)
    else:
        components["trends_velocity"] = None

    # 2. Trends coverage score (% of keywords with data)
    coverage = correlation.get("coverage", 0)
    total = correlation.get("total_keywords", 1)
    components["trends_coverage"] = round((coverage / total) * 100, 1)

    # 3. Correlation score (overall Pearson, normalized 0-100)
    overall_r = correlation.get("overall_score")
    if overall_r is not None:
        components["correlation"] = round((overall_r + 1) / 2 * 100, 1)
    else:
        components["correlation"] = None

    # 4. Reddit velocity score
    reddit_velocities = [
        reddit_data[k.term]["velocity"]
        for k in keywords
        if reddit_data and k.term in reddit_data and reddit_data[k.term].get("status") == "ok"
    ]
    if reddit_velocities:
        avg_rv = sum(reddit_velocities) / len(reddit_velocities)
        components["reddit_velocity"] = round(max(0, min(100, 50 + avg_rv)), 1)
    else:
        components["reddit_velocity"] = None

    # Weighted composite score
    weights = {"trends_velocity": 0.35, "trends_coverage": 0.15, "correlation": 0.35, "reddit_velocity": 0.15}
    scored = {k: v for k, v in components.items() if v is not None}
    if scored:
        total_weight = sum(weights[k] for k in scored)
        composite = sum(scored[k] * weights[k] for k in scored) / total_weight
        final_score = round(composite)
    else:
        final_score = 0

    # Label
    if final_score >= 75:
        label = "Strong"
    elif final_score >= 55:
        label = "Building"
    elif final_score >= 35:
        label = "Emerging"
    elif final_score >= 15:
        label = "Weak"
    else:
        label = "Noise"

    return {
        "score": final_score,
        "label": label,
        "components": components
    }

# ── Step 1: Generate keywords ──────────────────────────────────────────────────

@app.post("/api/generate-keywords")
async def generate_keywords(body: SignalInput):
    logger.info(f"[keywords] Generating keywords for: {body.description[:80]}...")
    try:
        msg = claude.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1500,
            system="""You are an expert at turning freeform cultural observations into optimized keyword clusters for signal analysis across Google Trends and Reddit.

Given a signal description, generate keywords across 4 clusters:
- core: literal, direct terms closest to the observation (mark 2-3 as anchor:true)
- behavioral: how people search when doing/wanting the thing
- community: how people talk about it in discourse, subcultures, aesthetic labels
- adjacent: things that move with it if the signal is real

Rules:
- Preserve the specific texture and subtlety of the original observation
- Anchor terms should be specific enough to be diagnostic but not so niche they return zero data
- Each keyword needs a rationale explaining what facet of the signal it captures
- Aim for 4-6 keywords per cluster, 16-24 total
- Optimize for Google Trends parsability — shorter phrases (2-4 words) perform better than long ones

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
        logger.info(f"[keywords] Generated {len(data['keywords'])} keywords")
        return {"success": True, "keywords": data["keywords"]}
    except Exception as e:
        logger.error(f"[keywords] Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ── Step 2: Google Trends ──────────────────────────────────────────────────────

@app.post("/api/trends")
async def get_trends(body: KeywordCluster):
    results = {}
    terms = [k.term for k in body.keywords]
    batches = [terms[i:i+5] for i in range(0, len(terms), 5)]
    logger.info(f"[trends] Starting fetch for {len(terms)} keywords in {len(batches[:4])} batches")

    try:
        pytrends = TrendReq(hl='en-US', tz=360, timeout=(10, 25))

        for batch_idx, batch in enumerate(batches[:4]):
            logger.info(f"[trends] Batch {batch_idx + 1}/{len(batches[:4])}: {batch}")
            attempt = 0
            max_attempts = 2
            while attempt < max_attempts:
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
                                logger.warning(f"[trends] No data for term: {term}")
                                results[term] = {"status": "no_data"}
                    else:
                        logger.warning(f"[trends] Batch {batch_idx + 1} returned empty — no data for: {batch}")
                        for term in batch:
                            results[term] = {"status": "no_data"}

                    break  # success, exit retry loop

                except Exception as e:
                    if "429" in str(e) and attempt == 0:
                        logger.warning(f"[trends] Rate limited (429) on batch {batch_idx + 1}, retrying in 5s...")
                        time.sleep(5)
                        attempt += 1
                        continue
                    logger.error(f"[trends] Batch {batch_idx + 1} failed: {e}")
                    for term in batch:
                        results[term] = {"status": "error", "detail": str(e)}
                    break

            time.sleep(2)

        ok_count = sum(1 for v in results.values() if v.get("status") == "ok")
        logger.info(f"[trends] Done — {ok_count}/{len(terms)} keywords returned data")
        return {"success": True, "results": results}

    except Exception as e:
        logger.error(f"[trends] Fatal error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ── Step 3: Reddit ─────────────────────────────────────────────────────────────

@app.post("/api/reddit")
async def get_reddit(body: KeywordCluster):
    if not REDDIT_ENABLED or reddit is None:
        logger.info("[reddit] Reddit integration disabled — skipping")
        return {"success": True, "results": {}, "disabled": True}

    results = {}
    logger.info(f"[reddit] Searching {min(len(body.keywords), 12)} keywords")
    for kw in body.keywords[:12]:
        try:
            recent_posts = list(reddit.subreddit("all").search(
                kw.term, sort="new", time_filter="week", limit=25
            ))
            month_posts = list(reddit.subreddit("all").search(
                kw.term, sort="new", time_filter="month", limit=50
            ))
            recent_count = len(recent_posts)
            month_count = len(month_posts)
            older_count = max(0, month_count - recent_count)
            velocity = ((recent_count - older_count) / max(older_count, 1)) * 100
            top_posts = sorted(recent_posts, key=lambda p: p.score, reverse=True)[:3]
            results[kw.term] = {
                "recent_count": recent_count,
                "month_count": month_count,
                "velocity": round(velocity, 1),
                "avg_score": round(sum(p.score for p in recent_posts) / max(recent_count, 1), 1),
                "avg_comments": round(sum(p.num_comments for p in recent_posts) / max(recent_count, 1), 1),
                "top_posts": [{"title": p.title, "subreddit": str(p.subreddit), "score": p.score, "comments": p.num_comments, "url": f"https://reddit.com{p.permalink}"} for p in top_posts],
                "status": "ok"
            }
        except Exception as e:
            logger.error(f"[reddit] Failed for '{kw.term}': {e}")
            results[kw.term] = {"status": "error", "detail": str(e)}

    ok_count = sum(1 for v in results.values() if v.get("status") == "ok")
    logger.info(f"[reddit] Done — {ok_count}/{min(len(body.keywords), 12)} keywords returned data")
    return {"success": True, "results": results}

# ── Step 4: Analyze ────────────────────────────────────────────────────────────

@app.post("/api/analyze")
async def analyze(body: AnalysisRequest):
    logger.info(f"[analyze] Starting analysis for: {body.description[:80]}...")
    try:
        trends_data = body.trends_data or {}
        reddit_data = body.reddit_data or {}
        logger.info(f"[analyze] Received {len(trends_data)} trends entries, {len(reddit_data)} reddit entries")

        # Compute correlation matrix from actual time series
        correlation = compute_correlation_matrix(trends_data, body.keywords)

        # Compute data-driven score
        signal = compute_signal_score(trends_data, reddit_data, body.keywords, correlation)

        # AI translates the keywords only — no scoring, no interpretation
        msg = claude.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=500,
            system="""You translate keyword cluster data into a brief plain-language description of what the signal is.
Do NOT score, evaluate, or interpret the strength of the signal.
Do NOT say whether this is strong or weak.
Just describe what the keyword cluster is collectively pointing at — what behavior, phenomenon, or cultural moment it represents.
2-3 sentences maximum. Return ONLY valid JSON:
{"signal_translation": "string"}""",
            messages=[{"role": "user", "content": f"Signal description: {body.description}\n\nKeyword clusters: {json.dumps([k.dict() for k in body.keywords])}"}]
        )
        translation_data = parse_json(msg.content[0].text)

        logger.info(f"[analyze] Score: {signal['score']} ({signal['label']}) | Correlation coverage: {correlation.get('coverage', 0)}/{correlation.get('total_keywords', 0)}")
        return {
            "success": True,
            "score": signal["score"],
            "label": signal["label"],
            "score_components": signal["components"],
            "correlation": correlation,
            "signal_translation": translation_data.get("signal_translation", ""),
        }

    except Exception as e:
        logger.error(f"[analyze] Failed: {e}")
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
        logger.info(f"[save] Signal saved: {result.data[0].get('id', 'unknown')}")
        return {"success": True, "signal": result.data[0]}
    except Exception as e:
        logger.error(f"[save] Failed to save signal: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/signals")
async def get_signals():
    try:
        result = supabase.table("signals").select("*").order("created_at", desc=True).execute()
        logger.info(f"[fetch] Returned {len(result.data)} signals")
        return {"success": True, "signals": result.data}
    except Exception as e:
        logger.error(f"[fetch] Failed to fetch signals: {e}")
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
