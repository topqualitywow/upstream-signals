import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from "recharts"

const CLUSTER_COLORS = {
  core: "#e8c547",
  behavioral: "#5b9cf6",
  community: "#7ed4a0",
  adjacent: "#c084fc"
}

const SCORE_COLORS = {
  Noise: "#444",
  Weak: "#666",
  Emerging: "#e8c547",
  Building: "#f4923a",
  Strong: "#5be094"
}

export default function SignalOutput({ description, keywords, analysis, trendsData, redditData, onReset }) {
  const scoreColor = SCORE_COLORS[analysis.signal_label] || "#666"

  // Build trends chart data
  const anchors = keywords.filter(k => k.anchor)
  const nonAnchors = keywords.filter(k => !k.anchor)
  const chartKeywords = [...anchors, ...nonAnchors].slice(0, 8)

  const trendsChartData = (() => {
    const validTerms = chartKeywords.filter(k => trendsData[k.term]?.status === "ok")
    if (validTerms.length === 0) return []

    const first = trendsData[validTerms[0].term]
    return first.dates.map((date, i) => {
      const point = { date: date.slice(5) } // MM-DD
      validTerms.forEach(k => {
        point[k.term] = trendsData[k.term]?.series?.[i] ?? 0
      })
      return point
    })
  })()

  // Build reddit bar chart data
  const redditChartData = keywords
    .filter(k => redditData[k.term]?.status === "ok")
    .map(k => ({
      term: k.term.length > 20 ? k.term.slice(0, 18) + "…" : k.term,
      fullTerm: k.term,
      recent: redditData[k.term].recent_count,
      velocity: redditData[k.term].velocity,
      cluster: k.cluster
    }))
    .sort((a, b) => b.recent - a.recent)
    .slice(0, 10)

  return (
    <div className="output-view">

      {/* Top signal score */}
      <div className="output-hero">
        <div className="output-score-wrap">
          <div className="output-score" style={{ color: scoreColor }}>
            {analysis.signal_score}
          </div>
          <div className="output-score-label" style={{ color: scoreColor }}>
            {analysis.signal_label}
          </div>
        </div>
        <div className="output-hero-right">
          <div className="output-signal-desc">{description}</div>
          <div className="output-confidence">
            <span className={`confidence-badge ${analysis.confidence}`}>{analysis.confidence} confidence</span>
            <span className="confidence-reason">{analysis.confidence_reason}</span>
          </div>
        </div>
      </div>

      {/* Correlation read */}
      <div className="output-card">
        <div className="card-label">Correlation read</div>
        <p className="card-body-lg">{analysis.correlation_read}</p>
        <div className="output-meta-row">
          <div className="output-meta-item">
            <span className="meta-label">Strongest cluster</span>
            <span className="meta-value" style={{ color: CLUSTER_COLORS[analysis.strongest_cluster] }}>
              {analysis.strongest_cluster}
            </span>
          </div>
          <div className="output-meta-item">
            <span className="meta-label">Reason</span>
            <span className="meta-value">{analysis.strongest_cluster_reason}</span>
          </div>
        </div>
      </div>

      {/* Anchor read */}
      <div className="output-card">
        <div className="card-label">Anchor keywords</div>
        <div className="anchor-chips">
          {keywords.filter(k => k.anchor).map(k => (
            <span key={k.term} className="anchor-chip">
              {k.term}
              {trendsData[k.term]?.velocity !== undefined && (
                <span className={`velocity ${trendsData[k.term].velocity > 0 ? "up" : "down"}`}>
                  {trendsData[k.term].velocity > 0 ? "+" : ""}{trendsData[k.term].velocity}%
                </span>
              )}
            </span>
          ))}
        </div>
        <p className="card-body">{analysis.anchor_read}</p>
      </div>

      {/* Google Trends chart */}
      {trendsChartData.length > 0 && (
        <div className="output-card chart-card">
          <div className="card-label">Google Trends — keyword comparison (90 days)</div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trendsChartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#555" }} interval={6} />
                <YAxis tick={{ fontSize: 10, fill: "#555" }} />
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid #222", fontSize: 11 }}
                  labelStyle={{ color: "#888" }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                {chartKeywords
                  .filter(k => trendsData[k.term]?.status === "ok")
                  .map((k, i) => (
                    <Line
                      key={k.term}
                      type="monotone"
                      dataKey={k.term}
                      stroke={CLUSTER_COLORS[k.cluster]}
                      strokeWidth={k.anchor ? 2.5 : 1.5}
                      dot={false}
                      opacity={k.anchor ? 1 : 0.65}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-note">Anchor keywords shown at full opacity</div>
        </div>
      )}

      {/* Reddit velocity chart */}
      {redditChartData.length > 0 && (
        <div className="output-card chart-card">
          <div className="card-label">Reddit — post volume &amp; velocity (last 7 days)</div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={redditChartData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10, fill: "#555" }} />
                <YAxis dataKey="term" type="category" tick={{ fontSize: 10, fill: "#888" }} width={120} />
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid #222", fontSize: 11 }}
                  formatter={(value, name) => [value, name === "recent" ? "Posts (7d)" : "Velocity %"]}
                />
                <Bar dataKey="recent" fill="#5b9cf6" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="reddit-velocity-row">
            {redditChartData.slice(0, 6).map(d => (
              <div key={d.fullTerm} className="velocity-item">
                <span className="velocity-term">{d.term}</span>
                <span className={`velocity-val ${d.velocity > 0 ? "up" : d.velocity < 0 ? "down" : "flat"}`}>
                  {d.velocity > 0 ? "↑" : d.velocity < 0 ? "↓" : "—"} {Math.abs(d.velocity)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Reddit posts */}
      {(() => {
        const allPosts = keywords
          .filter(k => redditData[k.term]?.top_posts?.length)
          .flatMap(k => redditData[k.term].top_posts.map(p => ({ ...p, keyword: k.term })))
          .sort((a, b) => b.score - a.score)
          .slice(0, 6)

        if (allPosts.length === 0) return null

        return (
          <div className="output-card">
            <div className="card-label">Top Reddit posts</div>
            <div className="posts-list">
              {allPosts.map((p, i) => (
                <a key={i} href={p.url} target="_blank" rel="noreferrer" className="post-item">
                  <div className="post-title">{p.title}</div>
                  <div className="post-meta">
                    <span>r/{p.subreddit}</span>
                    <span>{p.score} pts</span>
                    <span>{p.comments} comments</span>
                    <span className="post-keyword">{p.keyword}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )
      })()}

      {/* What to watch */}
      <div className="output-card">
        <div className="card-label">What to watch next</div>
        <ul className="watch-list">
          {analysis.what_to_watch?.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      </div>

      {/* Disconnected keywords */}
      {analysis.disconnected_keywords?.length > 0 && (
        <div className="output-card warn-card">
          <div className="card-label">Potentially disconnected keywords</div>
          <div className="disconnected-chips">
            {analysis.disconnected_keywords.map(k => (
              <span key={k} className="disconnected-chip">{k}</span>
            ))}
          </div>
          <p className="card-body">These keywords may not be closely related to your signal. Consider removing them in future runs.</p>
        </div>
      )}

      <div className="output-footer">
        <button className="reset-btn" onClick={onReset}>New Signal</button>
      </div>
    </div>
  )
}
