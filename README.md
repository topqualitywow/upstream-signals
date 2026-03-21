# Upstream v2 — Signal Intelligence

Validate upstream cultural signals through correlative keyword analysis across Google Trends and Reddit.

## Stack
- **Frontend**: React + Vite + Recharts → Vercel
- **Backend**: Python FastAPI + pytrends + PRAW → Render
- **DB**: Supabase
- **AI**: Claude API (Haiku)

## Setup

### 1. Supabase
Run `supabase-schema.sql` in your Supabase SQL editor.

### 2. Reddit API
Go to reddit.com/prefs/apps → Create app → Script type
Copy `client_id` and `client_secret`

### 3. Backend (Render)
- **Root Directory**: `backend`
- **Runtime**: Python
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Environment variables**:
  - `ANTHROPIC_API_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `REDDIT_CLIENT_ID`
  - `REDDIT_CLIENT_SECRET`

### 4. Frontend (Vercel)
- **Root Directory**: `frontend`
- **Framework**: Vite
- **Environment variable**: `VITE_API_URL` = your Render URL

## Flow
1. Describe a signal in freeform
2. AI generates keyword clusters (core, behavioral, community, adjacent)
3. Review and refine keywords before running
4. Analysis pulls Google Trends + Reddit data
5. Output shows correlation across keyword clusters with charts
