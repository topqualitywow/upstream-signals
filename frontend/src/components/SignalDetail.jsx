export default function SignalDetail({ signal, onBack, onDelete }) {
  const { parsed, analysis, raw_input, created_at } = signal;

  const momentumColors = {
    Weak: "#555",
    Emerging: "#c8a84b",
    Building: "#e07b39",
    Strong: "#4caf7d"
  };

  const confidenceColors = {
    low: "#666",
    medium: "#c8a84b",
    high: "#4caf7d"
  };

  const color = momentumColors[analysis?.momentum_label] || "#555";

  return (
    <div className="detail-view">
      <div className="detail-nav">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <button className="delete-btn" onClick={() => { if (confirm("Delete this signal?")) onDelete(signal.id); }}>
          Delete
        </button>
      </div>

      <div className="detail-header">
        <div className="detail-meta">
          <span className="detail-date">{new Date(created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          <span className="momentum-badge" style={{ color, borderColor: color }}>
            {analysis?.momentum_label || "—"}
          </span>
        </div>
        <h1 className="detail-title">{parsed?.title}</h1>
        <p className="detail-summary">{parsed?.summary}</p>
      </div>

      <div className="score-bar-wrap">
        <div className="score-bar-label">
          <span>Signal Momentum</span>
          <span style={{ color }}>{analysis?.momentum_score}/100</span>
        </div>
        <div className="score-bar-track">
          <div className="score-bar-fill" style={{ width: `${analysis?.momentum_score}%`, background: color }} />
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-card full">
          <div className="card-label">Upstream Read</div>
          <p className="card-body">{parsed?.upstream_nature}</p>
        </div>

        <div className="detail-card full">
          <div className="card-label">Causal Chain</div>
          <p className="card-body">{analysis?.upstream_downstream_read}</p>
          <div className="expected-downstream">
            <span className="card-sublabel">Expected downstream effects</span>
            <p>{parsed?.expected_downstream}</p>
          </div>
        </div>

        <div className="detail-card">
          <div className="card-label">Cultural Momentum</div>
          <div className="engagement-row">
            <span>Engagement</span>
            <span className={`engagement-pill ${analysis?.cultural_momentum?.engagement_signal}`}>
              {analysis?.cultural_momentum?.engagement_signal}
            </span>
          </div>
          <p className="card-body">{analysis?.cultural_momentum?.summary}</p>
          {analysis?.cultural_momentum?.top_communities?.length > 0 && (
            <div className="communities">
              {analysis.cultural_momentum.top_communities.map(c => (
                <a key={c} href={`https://reddit.com/r/${c}`} target="_blank" rel="noreferrer" className="community-tag">
                  r/{c}
                </a>
              ))}
            </div>
          )}
          {analysis?.cultural_momentum?.notable_posts?.length > 0 && (
            <div className="notable-posts">
              <span className="card-sublabel">Notable posts</span>
              {analysis.cultural_momentum.notable_posts.map((p, i) => (
                <div key={i} className="notable-post">
                  <span className="notable-title">{p.title}</span>
                  <span className="notable-why">{p.why_notable}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="detail-card">
          <div className="card-label">Search Momentum</div>
          <div className="engagement-row">
            <span>Trend direction</span>
            <span className={`engagement-pill ${analysis?.search_momentum?.trend_direction}`}>
              {analysis?.search_momentum?.trend_direction}
            </span>
          </div>
          <p className="card-body">{analysis?.search_momentum?.summary}</p>
          <div className="keywords-wrap">
            <span className="card-sublabel">Keywords tracked</span>
            <div className="keywords">
              {parsed?.keywords?.map(k => <span key={k} className="keyword-tag">{k}</span>)}
            </div>
          </div>
        </div>

        <div className="detail-card full">
          <div className="card-label">What to Watch</div>
          <ul className="watch-list">
            {analysis?.what_to_watch?.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>

        <div className="detail-card confidence-card">
          <div className="card-label">Confidence</div>
          <div className="confidence-level" style={{ color: confidenceColors[analysis?.confidence] }}>
            {analysis?.confidence?.toUpperCase()}
          </div>
          <p className="card-body">{analysis?.confidence_reasoning}</p>
        </div>
      </div>

      <details className="raw-details">
        <summary>Original observation</summary>
        <p className="raw-text">{raw_input}</p>
      </details>
    </div>
  );
}
