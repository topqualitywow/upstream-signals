const express = require('express');
const cors = require('cors');
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors({
  origin: [
    'https://upstream-signals.vercel.app',
    'http://localhost:5173',
    /\.vercel\.app$/
  ],
  credentials: true
}));
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// ── Parse signal with Claude ──────────────────────────────────────────────────
app.post('/api/parse-signal', async (req, res) => {
  const { raw } = req.body;
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `You are a cultural and market signal analyst. Given a freeform upstream signal observation, extract structured data. Return ONLY valid JSON, no markdown, no preamble.

Schema:
{
  "title": "short 4-8 word name for this signal",
  "summary": "1-2 sentence clean description of what was observed",
  "phenomenon": "the core behavior or pattern being observed",
  "keywords": ["3-6 specific search keywords most likely to surface related discourse and data"],
  "subreddit_targets": ["3-5 relevant subreddit names without r/ prefix"],
  "upstream_nature": "why this is an upstream signal — what makes it early or causal",
  "expected_downstream": "what behavioral or market effects you'd expect if this signal is real"
}`,
      messages: [{ role: 'user', content: raw }]
    });

    const parsed = JSON.parse(msg.content[0].text);
    res.json({ success: true, parsed });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ── Google Trends via unofficial proxy ───────────────────────────────────────
app.post('/api/trends', async (req, res) => {
  const { keywords } = req.body;
  try {
    const results = {};
    for (const kw of keywords.slice(0, 3)) {
      try {
        const url = `https://trends.google.com/trends/api/explore?hl=en-US&tz=-300&req=${encodeURIComponent(JSON.stringify({
          comparisonItem: [{ keyword: kw, geo: '', time: 'today 3-m' }],
          category: 0,
          property: ''
        }))}&tz=-300`;

        const r = await axios.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 8000
        });

        const clean = r.data.replace(/^\)\]\}'\\n/, '').replace(/^\)\]\}'\n/, '');
        results[kw] = { raw: clean.slice(0, 500), status: 'ok' };
      } catch {
        results[kw] = { status: 'unavailable' };
      }
    }
    res.json({ success: true, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Reddit search ─────────────────────────────────────────────────────────────
app.post('/api/reddit', async (req, res) => {
  const { keywords, subreddits } = req.body;
  try {
    const posts = [];

    for (const kw of keywords.slice(0, 2)) {
      try {
        const r = await axios.get(`https://www.reddit.com/search.json`, {
          params: { q: kw, sort: 'new', limit: 10, t: 'month' },
          headers: { 'User-Agent': 'SignalApp/1.0' },
          timeout: 8000
        });
        const items = r.data?.data?.children?.map(c => ({
          title: c.data.title,
          subreddit: c.data.subreddit,
          score: c.data.score,
          comments: c.data.num_comments,
          url: `https://reddit.com${c.data.permalink}`,
          created: new Date(c.data.created_utc * 1000).toISOString(),
          keyword: kw
        })) || [];
        posts.push(...items);
      } catch { }
    }

    for (const sub of subreddits.slice(0, 2)) {
      try {
        const r = await axios.get(`https://www.reddit.com/r/${sub}/search.json`, {
          params: { q: keywords[0], sort: 'new', limit: 5, restrict_sr: true },
          headers: { 'User-Agent': 'SignalApp/1.0' },
          timeout: 8000
        });
        const items = r.data?.data?.children?.map(c => ({
          title: c.data.title,
          subreddit: c.data.subreddit,
          score: c.data.score,
          comments: c.data.num_comments,
          url: `https://reddit.com${c.data.permalink}`,
          created: new Date(c.data.created_utc * 1000).toISOString(),
          targeted: true
        })) || [];
        posts.push(...items);
      } catch { }
    }

    const seen = new Set();
    const deduped = posts.filter(p => {
      if (seen.has(p.title)) return false;
      seen.add(p.title);
      return true;
    });

    res.json({ success: true, posts: deduped.slice(0, 20) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Synthesize analysis with Claude ──────────────────────────────────────────
app.post('/api/analyze', async (req, res) => {
  const { signal, redditPosts, trendsData } = req.body;
  try {
    const prompt = `You are a cultural and market signal analyst specializing in upstream trend detection.

UPSTREAM SIGNAL:
${JSON.stringify(signal, null, 2)}

REDDIT DISCOURSE (last 30 days):
${JSON.stringify(redditPosts?.slice(0, 15), null, 2)}

GOOGLE TRENDS DATA:
${JSON.stringify(trendsData, null, 2)}

Analyze the downstream data against this upstream signal. Return ONLY valid JSON:

{
  "momentum_score": <0-100 integer, how much downstream evidence supports this signal>,
  "momentum_label": <"Weak" | "Emerging" | "Building" | "Strong">,
  "cultural_momentum": {
    "summary": "2-3 sentences on what the Reddit and social data shows",
    "top_communities": ["subreddit names where this is active"],
    "engagement_signal": "low | medium | high",
    "notable_posts": [{"title": "...", "why_notable": "..."}]
  },
  "search_momentum": {
    "summary": "what the trends data suggests about search interest",
    "trend_direction": "rising | stable | declining | insufficient_data"
  },
  "upstream_downstream_read": "2-3 sentences on where this signal sits in the causal chain and what it likely predicts",
  "what_to_watch": ["3-4 specific things to monitor that would confirm or deny this signal is real"],
  "confidence": "low | medium | high",
  "confidence_reasoning": "1 sentence on why"
}`;

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const analysis = JSON.parse(msg.content[0].text);
    res.json({ success: true, analysis });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ── Save signal to Supabase ───────────────────────────────────────────────────
app.post('/api/signals', async (req, res) => {
  const { raw, parsed, analysis } = req.body;
  try {
    const { data, error } = await supabase
      .from('signals')
      .insert([{ raw_input: raw, parsed, analysis, created_at: new Date().toISOString() }])
      .select();
    if (error) throw error;
    res.json({ success: true, signal: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Get all signals ───────────────────────────────────────────────────────────
app.get('/api/signals', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('signals')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, signals: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Delete signal ─────────────────────────────────────────────────────────────
app.delete('/api/signals/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('signals').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Signal backend running on :${PORT}`));
