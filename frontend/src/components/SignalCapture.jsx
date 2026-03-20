import { useState } from "react";

export default function SignalCapture({ onSubmit, loading }) {
  const [raw, setRaw] = useState("");

  function handleKey(e) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && raw.trim()) {
      onSubmit(raw.trim());
    }
  }

  return (
    <div className="capture-view">
      <div className="capture-header">
        <h1 className="capture-title">What are you seeing?</h1>
        <p className="capture-sub">
          Drop a raw observation — a meme, a behavior pattern, something you're noticing. Be specific.
        </p>
      </div>

      <div className="capture-box">
        <textarea
          className="capture-input"
          value={raw}
          onChange={e => setRaw(e.target.value)}
          onKeyDown={handleKey}
          placeholder="e.g. I keep seeing girls on TikTok doing this specific hand gesture when unboxing beauty products. It started in niche corners about 3 weeks ago and I'm seeing it bleed into mainstream accounts now..."
          rows={7}
          disabled={loading}
          autoFocus
        />
        <div className="capture-footer">
          <span className="capture-hint">⌘ + Enter to analyze</span>
          <button
            className="capture-btn"
            onClick={() => raw.trim() && onSubmit(raw.trim())}
            disabled={loading || !raw.trim()}
          >
            {loading ? (
              <span className="loading-state">
                <span className="spinner" />
                Analyzing signal...
              </span>
            ) : (
              "Analyze Signal →"
            )}
          </button>
        </div>
      </div>

      {loading && (
        <div className="loading-steps">
          <div className="step">◈ Parsing signal structure</div>
          <div className="step">◈ Pulling Reddit discourse</div>
          <div className="step">◈ Checking Google Trends</div>
          <div className="step">◈ Running correlative analysis</div>
        </div>
      )}

      <div className="capture-examples">
        <p className="examples-label">Try something like</p>
        <div className="examples-list">
          {[
            "I keep seeing memes about 'girl dinner' being replaced by elaborate solo cooking rituals on niche food subreddits",
            "There's a growing discourse on X about people quitting streaming and going back to buying physical media",
            "Micro-communities on Reddit are organizing around 'no phone dinner' challenges — seeing it spread to mainstream parenting forums"
          ].map((ex, i) => (
            <button
              key={i}
              className="example-chip"
              onClick={() => setRaw(ex)}
              disabled={loading}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
