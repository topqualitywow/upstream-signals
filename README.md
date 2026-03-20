# Upstream — Signal Intelligence

Capture upstream cultural and behavioral signals. Get immediate correlative analysis against Reddit discourse and Google Trends. Understand where a signal sits in the causal chain before it becomes obvious.

---

## Stack

| Layer | Tech | Host |
|---|---|---|
| Frontend | React + Vite | Vercel |
| Backend | Node + Express | Render |
| Database | Supabase (Postgres) | Supabase |
| AI | Claude API (Sonnet) | Anthropic |

---

## Setup — Step by Step

### 1. Supabase (Database)

1. Go to [supabase.com](https://supabase.com) → New project
2. Once created, go to **SQL Editor** and run the contents of `supabase-schema.sql`
3. Go to **Settings → API** and copy:
   - `Project URL` → this is your `SUPABASE_URL`
   - `anon public` key → this is your `SUPABASE_ANON_KEY`

---

### 2. Backend — Local setup

```bash
cd backend
cp .env.example .env
# Fill in your keys in .env
npm install
npm run dev
# Runs on http://localhost:3001
```

Your `.env` needs:
```
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
PORT=3001
```

---

### 3. Frontend — Local setup

```bash
cd frontend
cp .env.example .env.local
# Set VITE_API_URL=http://localhost:3001 for local dev
npm install
npm run dev
# Runs on http://localhost:5173
```

---

### 4. Deploy Backend → Render

1. Push your code to GitHub (you can push the whole `signal-app` folder)
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your repo, set **Root Directory** to `backend`
4. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
5. Add environment variables (same as your `.env`):
   - `ANTHROPIC_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
6. Deploy. Copy the URL Render gives you (e.g. `https://signal-backend.onrender.com`)

> **Note:** Render free tier spins down after inactivity. First request after sleep takes ~30s. Upgrade to paid ($7/mo) to keep it awake.

---

### 5. Deploy Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your repo, set **Root Directory** to `frontend`
3. Add environment variable:
   - `VITE_API_URL` = your Render backend URL (e.g. `https://signal-backend.onrender.com`)
4. Deploy.

---

## How It Works

### Signal Flow

```
You type a raw observation
        ↓
Claude parses it into a structured record
  - title, summary, phenomenon
  - keywords for search/reddit
  - upstream nature + expected downstream effects
        ↓
Reddit API pulls discourse matching keywords
  - keyword search across all of Reddit
  - targeted subreddit search
        ↓
Google Trends proxy checks search momentum
        ↓
Claude synthesizes everything into analysis:
  - momentum score (0–100)
  - cultural momentum read
  - search momentum direction
  - upstream → downstream causal read
  - what to watch next
  - confidence level
        ↓
Saved to Supabase, displayed in detail view
```

### Momentum Labels

| Label | What it means |
|---|---|
| Weak | Little downstream evidence yet |
| Emerging | Some early signals in the data |
| Building | Multiple indicators moving |
| Strong | Clear downstream confirmation |

---

## Roadmap

- [ ] News API integration (editorial pickup)
- [ ] Alpha Vantage (sector + stock movement)
- [ ] Time window monitoring (re-run analysis on a signal after N days)
- [ ] Trend definition layer (group signals into named hypotheses)
- [ ] Signal comparison view (correlate multiple signals)
