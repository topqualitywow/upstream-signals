import { useState } from "react"

const CLUSTERS = ["core", "behavioral", "community", "adjacent"]
const CLUSTER_LABELS = {
  core: "Core",
  behavioral: "Behavioral",
  community: "Community",
  adjacent: "Adjacent"
}
const CLUSTER_DESC = {
  core: "Literal terms closest to your observation",
  behavioral: "How people search when doing or wanting this",
  community: "Discourse labels, aesthetics, subcultures",
  adjacent: "Things that move with it if the signal is real"
}
const CLUSTER_COLORS = {
  core: "#e8c547",
  behavioral: "#5b9cf6",
  community: "#7ed4a0",
  adjacent: "#c084fc"
}

export default function KeywordConfig({ description, keywords, onConfirm, onBack, onChange }) {
  const [newTerm, setNewTerm] = useState("")
  const [newCluster, setNewCluster] = useState("core")
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState("")

  const byCluster = CLUSTERS.reduce((acc, c) => {
    acc[c] = keywords.filter(k => k.cluster === c)
    return acc
  }, {})

  function removeKeyword(term) {
    onChange(keywords.filter(k => k.term !== term))
  }

  function toggleAnchor(term) {
    onChange(keywords.map(k => k.term === term ? { ...k, anchor: !k.anchor } : k))
  }

  function addKeyword() {
    if (!newTerm.trim()) return
    onChange([...keywords, {
      term: newTerm.trim(),
      cluster: newCluster,
      rationale: "Added manually",
      anchor: false
    }])
    setNewTerm("")
  }

  function startEdit(kw) {
    setEditingId(kw.term)
    setEditValue(kw.term)
  }

  function saveEdit(oldTerm) {
    if (!editValue.trim()) return
    onChange(keywords.map(k => k.term === oldTerm ? { ...k, term: editValue.trim() } : k))
    setEditingId(null)
  }

  return (
    <div className="config-view">
      <div className="config-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="config-title-wrap">
          <div className="config-eyebrow">Keyword configuration</div>
          <h2 className="config-title">Review and refine your signal cluster</h2>
          <p className="config-desc">
            These keywords will be used to search Google Trends and Reddit.
            Edit, remove, or add terms until the cluster accurately captures your signal.
          </p>
        </div>
      </div>

      <div className="config-signal-preview">
        <span className="config-signal-label">Your signal</span>
        <p className="config-signal-text">{description}</p>
      </div>

      <div className="config-clusters">
        {CLUSTERS.map(cluster => (
          <div key={cluster} className="cluster-section">
            <div className="cluster-header">
              <div className="cluster-dot" style={{ background: CLUSTER_COLORS[cluster] }} />
              <div>
                <div className="cluster-name">{CLUSTER_LABELS[cluster]}</div>
                <div className="cluster-desc">{CLUSTER_DESC[cluster]}</div>
              </div>
              <div className="cluster-count">{byCluster[cluster].length}</div>
            </div>
            <div className="cluster-keywords">
              {byCluster[cluster].map(kw => (
                <div key={kw.term} className={`keyword-chip ${kw.anchor ? "anchor" : ""}`}>
                  {editingId === kw.term ? (
                    <input
                      className="keyword-edit-input"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={() => saveEdit(kw.term)}
                      onKeyDown={e => e.key === "Enter" && saveEdit(kw.term)}
                      autoFocus
                    />
                  ) : (
                    <>
                      <span className="keyword-term" onClick={() => startEdit(kw)}>{kw.term}</span>
                      {kw.anchor && <span className="anchor-badge">anchor</span>}
                      <div className="keyword-actions">
                        <button
                          className="kw-btn"
                          title={kw.anchor ? "Remove anchor" : "Mark as anchor"}
                          onClick={() => toggleAnchor(kw.term)}
                        >
                          {kw.anchor ? "★" : "☆"}
                        </button>
                        <button
                          className="kw-btn remove"
                          onClick={() => removeKeyword(kw.term)}
                        >×</button>
                      </div>
                    </>
                  )}
                  {!editingId && (
                    <div className="keyword-rationale">{kw.rationale}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="config-add">
        <div className="config-add-label">Add a keyword</div>
        <div className="config-add-row">
          <input
            className="config-add-input"
            value={newTerm}
            onChange={e => setNewTerm(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addKeyword()}
            placeholder="Type a term..."
          />
          <select
            className="config-add-select"
            value={newCluster}
            onChange={e => setNewCluster(e.target.value)}
          >
            {CLUSTERS.map(c => (
              <option key={c} value={c}>{CLUSTER_LABELS[c]}</option>
            ))}
          </select>
          <button className="config-add-btn" onClick={addKeyword}>Add</button>
        </div>
      </div>

      <div className="config-footer">
        <div className="config-summary">
          <span>{keywords.length} keywords</span>
          <span>·</span>
          <span>{keywords.filter(k => k.anchor).length} anchors</span>
        </div>
        <button
          className="confirm-btn"
          onClick={() => onConfirm(keywords)}
          disabled={keywords.length === 0}
        >
          Run Analysis →
        </button>
      </div>
    </div>
  )
}
