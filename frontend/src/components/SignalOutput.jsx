import { useState } from "react"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, ScatterChart, Scatter, CartesianGrid } from "recharts"

const CLUSTER_COLORS = {
  core: "#e8c547",
  behavioral: "#5b9cf6",
  community: "#7ed4a0",
  adjacent: "#c084fc"
}

const SCORE_COLORS = {
  Noise: "#444",
  Weak: "#888",
  Emerging: "#e8c547",
  Building: "#f4923a",
  Strong: "#5be094"
}

function KeywordChip({ kw, trendsData }) {
  const [show, setShow] = useState(false)
  const td = trendsData?.[kw.term]
  const hasData = td?.status === "ok"
  const trendsUrl = `https://trends.google.com/trends/explore?q=${encodeURIComponent(kw.term)}&date=today%203-m`

  return (
    <div
      className="kw-chip-wrap"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onTouchStart={() => setShow(v => !v)}
    >
      <div className={`kw-chip ${kw.anchor ? "anchor" : ""}`} style={{ borderColor: kw.anchor ? CLUSTER_COLORS[kw.cluster] : undefined }}>
        <span className="kw-chip-term">{kw.term}</span>
        {hasData && (
          <span className={`kw-chip-velocity ${td.velocity > 0 ? "up" : td.velocity < 0 ? "down" : "flat"}`}>
            {td.velocity > 0 ? "+" : ""}{td.velocity}%
          </span>
        )}
        {td?.status === "no_data" && <span className="kw-chip-velocity flat">—</span>}
        {td?.status === "error" && <span className="kw-chip-velocity flat">429</span>}
      </div>

      {show && (
        <div className="kw-tooltip">
          <div className="kw-tt-header">
            <span className="kw-tt-term">{kw.term}</span>
            <span className="kw-tt-cluster" style={{ color: CLUSTER_COLORS[kw.cluster] }}>{kw.cluster}</span>
          </div>
          <div className="kw-tt-rationale">{kw.rationale}</div>
          {hasData && (
            <div className="kw-tt-data">
              <div className="kw-tt-row"><span>Avg (90d)</span><strong>{td.avg}</strong></div>
              <div className="kw-tt-row"><span>Recent avg</span><strong>{td.recent_avg}</strong></div>
              <div className="kw-tt-row">
                <span>Velocity</span>
                <strong style={{ color: td.velocity > 0 ? "#5be094" : td.velocity < 0 ? "#e05555" : "#888" }}>
                  {td.velocity > 0 ? "+" : ""}{td.velocity}%
                </strong>
              </div>
              <div className="kw-tt-row"><span>Source</span><strong>Google Trends</strong></div>
              <div className="kw-tt-row"><span>Timeframe</span><strong>90 days</strong></div>
            </div>
          )}
          {td?.status === "error" && <div className="kw-tt-error">Rate limited (429) — try again shortly</div>}
          {td?.status === "no_data" && <div className="kw-tt-error">No search volume data available</div>}
          <a href={trendsUrl} target="_blank" rel="noreferrer" className="kw-tt-link">
            View on Google Trends →
          </a>
        </div>
      )}
    </div>
  )
}

function ScoreBreakdown({ components }) {
  const labels = {
    trends_velocity: "Trends velocity",
    trends_coverage: "Data coverage",
    correlation: "Keyword correlation",
    reddit_velocity: "Reddit velocity"
  }
  return (
    <div className="score-breakdown">
      {Object.entries(labels).map(([key, label]) => {
        const val = components?.[key]
        return (
          <div key={key} className="score-row">
            <span className="score-row-label">{label}</span>
            <div className="score-row-bar-wrap">
              <div
                className="score-row-bar"
                style={{ width: val !== null && val !== undefined ? `${val}%` : "0%", opacity: val !== null && val !== undefined ? 1 : 0.2 }}
              />
            </div>
            <span className="score-row-val">
              {val !== null && val !== undefined ? `${val}` : "—"}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function CorrelationMatrix({ correlation, keywords }) {
  if (!correlation?.pairs?.length) return null

  const topPairs = [...correlation.pairs]
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
    .slice(0, 8)

  return (
    <div className="corr-matrix">
      <div className="corr-pairs">
        {topPairs.map((p, i) => (
          <div key={i} className="corr-pair">
            <div className="corr-pair-terms">
              <span style={{ color: CLUSTER_COLORS[p.cluster_a] }}>{p.term_a}</span>
              <span className="corr-pair-sep">↔</span>
              <span style={{ color: CLUSTER_COLORS[p.cluster_b] }}>{p.term_b}</span>
            </div>
            <div className="corr-pair-bar-wrap">
              <div
                className="corr-pair-bar"
                style={{
                  width: `${Math.abs(p.r) * 100}%`,
                  background: p.r > 0 ? "#5be094" : "#e05555"
                }}
              />
            </div>
            <span className={`corr-pair-val ${p.r > 0.5 ? "strong" : p.r > 0 ? "weak" : "neg"}`}>
              {p.r > 0 ? "+" : ""}{p.r}
            </span>
          </div>
        ))}
      </div>
      {correlation.cluster_scores && Object.keys(correlation.cluster_scores).length > 0 && (
        <div className="corr-clusters">
          <div className="corr-cluster-label">Cross-cluster correlation</div>
          {Object.entries(correlation.cluster_scores).map(([key, val]) => {
            const [a, b] = key.split("_")
            return (
              <div key={key} className="corr-cluster-row">
                <span style={{ color: CLUSTER_COLORS[a] }}>{a}</span>
                <span className="corr-pair-sep">↔</span>
                <span style={{ color: CLUSTER_COLORS[b] }}>{b}</span>
                <span className={`corr-pair-val ${val > 0.5 ? "strong" : val > 0 ? "weak" : "neg"}`}>
                  {val > 0 ? "+" : ""}{val}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function SignalOutput({ description, keywords, result, trendsData, redditData, onReset }) {
  const { score, label, score_components, correlation, signal_translation } = result || {}
  const scoreColor = SCORE_COLORS[label] || "#666"

  const chartKeywords = [...keywords.filter(k => k.anchor), ...keywords.filter(k => !k.anchor)].slice(0, 8)

  const trendsChartData = (() => {
    const valid = chartKeywords.filter(k => trendsData?.[k.term]?.status === "ok")
    if (!valid.length) return []
    const first = trendsData[valid[0].term]
    return first.dates.map((date, i) => {
      const pt = { date: date.slice(5) }
      valid.forEach(k => { pt[k.term] = trendsData[k.term]?.series?.[i] ?? 0 })
      return pt
    })
  })()

  const redditChartData = keywords
    .filter(k => redditData?.[k.term]?.status === "ok")
    .map(k => ({
      term: k.term.length > 20 ? k.term.slice(0, 18) + "…" : k.term,
      fullTerm: k.term,
      recent: redditData[k.term].recent_count,
      velocity: redditData[k.term].velocity,
      cluster: k.cluster
    }))
    .sort((a, b) => b.recent - a.recent)
    .slice(0, 10)

  const validCount = keywords.filter(k => trendsData?.[k.term]?.status === "ok").length

  return (
    <div className="output-view">

      {/* Score header */}
      <div className="output-hero">
        <div className="output-score-wrap">
          <div className="output-score" style={{ color: scoreColor }}>{score ?? "—"}</div>
          <div className="output-score-label" style={{ color: scoreColor }}>{label ?? "—"}</div>
        </div>
        <div className="output-hero-right">
          <div className="output-signal-desc">{description}</div>
          {signal_translation && (
            <div className="output-translation">{signal_translation}</div>
          )}
        </div>
      </div>

      {/* Score breakdown */}
      <div className="output-card">
        <div className="card-label">Signal score breakdown</div>
        <ScoreBreakdown components={score_components} />
        <div className="score-note">Score derived from Trends velocity, data coverage, keyword correlation, and Reddit velocity. No AI scoring.</div>
      </div>

      {/* Data coverage */}
      <div className="output-card coverage-card">
        <div className="coverage-row">
          <div className="coverage-item">
            <div className="coverage-num">{validCount}/{keywords.length}</div>
            <div className="coverage-label">Keywords with Trends data</div>
          </div>
          <div className="coverage-item">
            <div className="coverage-num">{correlation?.overall_score !== null && correlation?.overall_score !== undefined ? correlation.overall_score : "—"}</div>
            <div className="coverage-label">Overall correlation (r)</div>
          </div>
          <div className="coverage-item">
            <div className="coverage-num">{redditData && Object.values(redditData).filter(v => v.status === "ok").length > 0 ? Object.values(redditData).filter(v => v.status === "ok").length : "—"}</div>
            <div className="coverage-label">Reddit keywords tracked</div>
          </div>
          <div className="coverage-item">
            <a
              href={`https://trends.google.com/trends/explore?q=${keywords.filter(k => trendsData?.[k.term]?.status === "ok").slice(0,5).map(k => encodeURIComponent(k.term)).join(",")}&date=today%203-m`}
              target="_blank"
              rel="noreferrer"
              className="coverage-link"
            >
              Open in Google Trends →
            </a>
          </div>
        </div>
      </div>

      {/* All keywords with hover */}
      <div className="output-card">
        <div className="card-label">Keywords — hover for detail</div>
        <div className="kw-chips-all">
          {keywords.map(k => (
            <KeywordChip key={k.term} kw={k} trendsData={trendsData} />
          ))}
        </div>
      </div>

      {/* Google Trends chart */}
      {trendsChartData.length > 0 ? (
        <div className="output-card chart-card">
          <div className="card-label-row">
            <div className="card-label">Google Trends — keyword comparison (90 days)</div>
            <a
              href={`https://trends.google.com/trends/explore?q=${chartKeywords.filter(k => trendsData?.[k.term]?.status === "ok").slice(0,5).map(k => encodeURIComponent(k.term)).join(",")}&date=today%203-m`}
              target="_blank" rel="noreferrer" className="card-source-link"
            >Source ↗</a>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trendsChartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#555" }} interval={6} />
                <YAxis tick={{ fontSize: 10, fill: "#555" }} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "#111", border: "1px solid #222", fontSize: 11 }} labelStyle={{ color: "#888" }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                {chartKeywords.filter(k => trendsData?.[k.term]?.status === "ok").map(k => (
                  <Line key={k.term} type="monotone" dataKey={k.term}
                    stroke={CLUSTER_COLORS[k.cluster]} strokeWidth={k.anchor ? 2.5 : 1.5}
                    dot={false} opacity={k.anchor ? 1 : 0.6}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-note">Scale 0–100 (relative interest) · Anchor keywords at full opacity · Source: Google Trends</div>
        </div>
      ) : (
        <div className="output-card no-data-card">
          <div className="card-label">Google Trends</div>
          <div className="no-data-msg">
            No data returned — Google may be rate limiting. Try again in a few minutes or
            <a href={`https://trends.google.com/trends/explore?q=${keywords.slice(0,3).map(k => encodeURIComponent(k.term)).join(",")}&date=today%203-m`}
              target="_blank" rel="noreferrer" className="no-data-link"> view manually →</a>
          </div>
        </div>
      )}

      {/* Correlation matrix */}
      {correlation?.pairs?.length > 0 && (
        <div className="output-card">
          <div className="card-label-row">
            <div className="card-label">Keyword correlation (Pearson r)</div>
            <span className="card-label-note">Based on Google Trends time series</span>
          </div>
          <CorrelationMatrix correlation={correlation} keywords={keywords} />
          <div className="chart-note">+1.0 = perfect co-movement · 0 = no relationship · −1.0 = inverse</div>
        </div>
      )}

      {/* Reddit chart */}
      {redditChartData.length > 0 && (
        <div className="output-card chart-card">
          <div className="card-label-row">
            <div className="card-label">Reddit — post volume (last 7 days)</div>
            <a href={`https://www.reddit.com/search/?q=${encodeURIComponent(keywords[0]?.term || "")}&sort=new&t=week`}
              target="_blank" rel="noreferrer" className="card-source-link">Source ↗</a>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={redditChartData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10, fill: "#555" }} />
                <YAxis dataKey="term" type="category" tick={{ fontSize: 10, fill: "#888" }} width={120} />
                <Tooltip contentStyle={{ background: "#111", border: "1px solid #222", fontSize: 11 }} formatter={(v) => [v, "Posts (7d)"]} />
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
        const posts = keywords
          .filter(k => redditData?.[k.term]?.top_posts?.length)
          .flatMap(k => redditData[k.term].top_posts.map(p => ({ ...p, keyword: k.term })))
          .sort((a, b) => b.score - a.score).slice(0, 6)
        if (!posts.length) return null
        return (
          <div className="output-card">
            <div className="card-label">Top Reddit posts</div>
            <div className="posts-list">
              {posts.map((p, i) => (
                <a key={i} href={p.url} target="_blank" rel="noreferrer" className="post-item">
                  <div className="post-title">{p.title}</div>
                  <div className="post-meta">
                    <span>r/{p.subreddit}</span><span>{p.score} pts</span>
                    <span>{p.comments} comments</span>
                    <span className="post-keyword">{p.keyword}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )
      })()}

      <div className="output-footer">
        <button className="reset-btn" onClick={onReset}>New Signal</button>
      </div>
    </div>
  )
}
