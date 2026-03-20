export default function SignalList({ signals, onSelect, onDelete }) {
  const momentumColors = {
    Weak: "#555",
    Emerging: "#c8a84b",
    Building: "#e07b39",
    Strong: "#4caf7d"
  };

  if (signals.length === 0) {
    return (
      <div className="list-empty">
        <div className="empty-icon">◈</div>
        <p>No signals yet. Capture your first observation.</p>
      </div>
    );
  }

  return (
    <div className="list-view">
      <div className="list-header">
        <h2>Signals</h2>
        <span className="list-count">{signals.length} logged</span>
      </div>
      <div className="signal-list">
        {signals.map(s => {
          const color = momentumColors[s.analysis?.momentum_label] || "#555";
          return (
            <div key={s.id} className="signal-row" onClick={() => onSelect(s)}>
              <div className="signal-row-left">
                <div className="signal-row-score" style={{ color }}>
                  {s.analysis?.momentum_score ?? "—"}
                </div>
                <div className="signal-row-info">
                  <div className="signal-row-title">{s.parsed?.title}</div>
                  <div className="signal-row-summary">{s.parsed?.summary}</div>
                  <div className="signal-row-meta">
                    <span className="signal-row-date">
                      {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <span className="signal-row-badge" style={{ color, borderColor: color }}>
                      {s.analysis?.momentum_label}
                    </span>
                    <span className="signal-row-confidence">
                      {s.analysis?.confidence} confidence
                    </span>
                  </div>
                </div>
              </div>
              <button
                className="signal-row-delete"
                onClick={e => { e.stopPropagation(); if (confirm("Delete?")) onDelete(s.id); }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
