import { useEffect, useState } from "react"

const SCORE_COLORS = {
  Noise: "#444",
  Weak: "#666",
  Emerging: "#e8c547",
  Building: "#f4923a",
  Strong: "#5be094"
}

export default function SignalHistory({ api, onSelect }) {
  const [signals, setSignals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${api}/api/signals`)
      .then(r => r.json())
      .then(d => { if (d.success) setSignals(d.signals) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="history-loading">Loading...</div>

  if (signals.length === 0) return (
    <div className="history-empty">
      <div className="empty-icon">▲</div>
      <p>No signals logged yet.</p>
    </div>
  )

  return (
    <div className="history-view">
      <div className="history-header">
        <h2>Signal history</h2>
        <span>{signals.length} logged</span>
      </div>
      <div className="history-list">
        {signals.map(s => {
          const color = SCORE_COLORS[s.analysis?.signal_label] || "#444"
          return (
            <div key={s.id} className="history-item" onClick={() => onSelect(s)}>
              <div className="history-score" style={{ color }}>{s.analysis?.signal_score ?? "—"}</div>
              <div className="history-info">
                <div className="history-desc">{s.raw_input}</div>
                <div className="history-meta">
                  <span style={{ color }}>{s.analysis?.signal_label}</span>
                  <span>{new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  <span>{s.parsed?.keywords?.length ?? 0} keywords</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
