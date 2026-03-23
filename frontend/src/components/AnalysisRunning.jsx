export default function AnalysisRunning({ keywords }) {
  const steps = [
    { label: "Querying Google Trends", detail: `Comparing ${keywords.length} keywords over 90 days` },
    { label: "Scanning Reddit discourse", detail: "Measuring velocity across recent vs prior period" },
    { label: "Running correlation analysis", detail: "Assessing whether clusters are moving together" },
    { label: "Generating signal read", detail: "Scoring and interpreting the evidence" }
  ]

  return (
    <div className="running-view">
      <div className="running-inner">
        <div className="running-icon">
          <div className="running-pulse" />
        </div>
        <h2 className="running-title">Analyzing signal</h2>
        <p className="running-sub">This takes about 30 seconds</p>

        <div className="running-steps">
          {steps.map((s, i) => (
            <div key={i} className="running-step" style={{ animationDelay: `${i * 0.8}s` }}>
              <div className="running-step-dot" style={{ animationDelay: `${i * 0.8}s` }} />
              <div className="running-step-content">
                <div className="running-step-label">{s.label}</div>
                <div className="running-step-detail">{s.detail}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="running-keywords">
          {keywords.map(k => (
            <span key={k.term} className={`running-kw ${k.anchor ? "anchor" : ""}`}>
              {k.term}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
