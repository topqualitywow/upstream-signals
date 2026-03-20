import { useState, useEffect } from "react";
import SignalCapture from "./components/SignalCapture";
import SignalList from "./components/SignalList";
import SignalDetail from "./components/SignalDetail";
import "./index.css";

export default function App() {
  const [view, setView] = useState("capture");
  const [signals, setSignals] = useState([]);
  const [activeSignal, setActiveSignal] = useState(null);
  const [loading, setLoading] = useState(false);

  const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

  useEffect(() => {
    fetchSignals();
  }, []);

  async function fetchSignals() {
    try {
      const r = await fetch(`${API}/api/signals`);
      const d = await r.json();
      if (d.success) setSignals(d.signals);
    } catch {}
  }

  async function handleSignalSubmit(raw) {
    setLoading(true);
    try {
      const parseRes = await fetch(`${API}/api/parse-signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw })
      });
      const { parsed } = await parseRes.json();

      const [redditRes, trendsRes] = await Promise.all([
        fetch(`${API}/api/reddit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keywords: parsed.keywords, subreddits: parsed.subreddit_targets })
        }),
        fetch(`${API}/api/trends`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keywords: parsed.keywords })
        })
      ]);

      const { posts } = await redditRes.json();
      const { results: trendsData } = await trendsRes.json();

      const analysisRes = await fetch(`${API}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signal: parsed, redditPosts: posts, trendsData })
      });
      const { analysis } = await analysisRes.json();

      const saveRes = await fetch(`${API}/api/signals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw, parsed, analysis })
      });
      const { signal } = await saveRes.json();

      setSignals(prev => [signal, ...prev]);
      setActiveSignal(signal);
      setView("detail");
    } catch (e) {
      console.error(e);
      alert("Something went wrong. Check the console.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    await fetch(`${API}/api/signals/${id}`, { method: "DELETE" });
    setSignals(prev => prev.filter(s => s.id !== id));
    if (activeSignal?.id === id) {
      setActiveSignal(null);
      setView("list");
    }
  }

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-logo">
          <span className="nav-logo-mark">◈</span>
          <span className="nav-logo-text">UPSTREAM</span>
        </div>
        <div className="nav-links">
          <button className={view === "capture" ? "active" : ""} onClick={() => setView("capture")}>
            New Signal
          </button>
          <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
            Signals {signals.length > 0 && <span className="count">{signals.length}</span>}
          </button>
        </div>
      </nav>

      <main className="main">
        {view === "capture" && (
          <SignalCapture onSubmit={handleSignalSubmit} loading={loading} />
        )}
        {view === "list" && (
          <SignalList
            signals={signals}
            onSelect={(s) => { setActiveSignal(s); setView("detail"); }}
            onDelete={handleDelete}
          />
        )}
        {view === "detail" && activeSignal && (
          <SignalDetail
            signal={activeSignal}
            onBack={() => setView("list")}
            onDelete={handleDelete}
          />
        )}
      </main>
    </div>
  );
}
