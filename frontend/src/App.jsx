import { useState } from "react"
import SignalInput from "./components/SignalInput"
import KeywordConfig from "./components/KeywordConfig"
import AnalysisRunning from "./components/AnalysisRunning"
import SignalOutput from "./components/SignalOutput"
import SignalHistory from "./components/SignalHistory"
import "./index.css"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"

export default function App() {
  const [step, setStep] = useState("input")
  const [description, setDescription] = useState("")
  const [keywords, setKeywords] = useState([])
  const [trendsData, setTrendsData] = useState({})
  const [redditData, setRedditData] = useState({})
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function handleDescriptionSubmit(desc) {
    setDescription(desc)
    setError(null)
    setStep("loading-keywords")
    try {
      const r = await fetch(`${API}/api/generate-keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc })
      })
      const d = await r.json()
      if (!d.success) throw new Error(d.detail)
      setKeywords(d.keywords)
      setStep("config")
    } catch (e) {
      setError(e.message)
      setStep("input")
    }
  }

  async function handleConfigConfirm(confirmedKeywords) {
    setKeywords(confirmedKeywords)
    setStep("running")
    setError(null)

    try {
      const kwBody = { keywords: confirmedKeywords }

      // Fetch Trends + Reddit in parallel
      const [trendsRes, redditRes] = await Promise.all([
        fetch(`${API}/api/trends`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(kwBody)
        }),
        fetch(`${API}/api/reddit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(kwBody)
        })
      ])

      const trends = await trendsRes.json()
      const reddit = await redditRes.json()
      const td = trends.results || {}
      const rd = reddit.results || {}

      setTrendsData(td)
      setRedditData(rd)

      // Analyze with actual data — AI translates only
      const analysisRes = await fetch(`${API}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          keywords: confirmedKeywords,
          trends_data: td,
          reddit_data: rd
        })
      })

      const analysisData = await analysisRes.json()
      if (!analysisData.success) throw new Error(analysisData.detail)
      setResult(analysisData)

      // Save to Supabase
      await fetch(`${API}/api/signals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          keywords: confirmedKeywords,
          analysis: analysisData,
          trends_data: td,
          reddit_data: rd
        })
      })

      setStep("output")
    } catch (e) {
      setError(e.message)
      setStep("config")
    }
  }

  function handleReset() {
    setStep("input")
    setDescription("")
    setKeywords([])
    setTrendsData({})
    setRedditData({})
    setResult(null)
    setError(null)
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-mark">▲</span>
            <span className="logo-text">UPSTREAM</span>
          </div>
          <nav className="header-nav">
            <button
              className={step === "history" ? "nav-btn active" : "nav-btn"}
              onClick={() => step !== "history" ? setStep("history") : setStep("input")}
            >
              {step === "history" ? "New Signal" : "History"}
            </button>
          </nav>
        </div>
      </header>

      <main className="main">
        {error && (
          <div className="error-banner">
            <span>⚠ {error}</span>
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        {(step === "input" || step === "loading-keywords") && (
          <SignalInput onSubmit={handleDescriptionSubmit} loading={step === "loading-keywords"} />
        )}
        {step === "config" && (
          <KeywordConfig
            description={description}
            keywords={keywords}
            onConfirm={handleConfigConfirm}
            onBack={() => setStep("input")}
            onChange={setKeywords}
          />
        )}
        {step === "running" && <AnalysisRunning keywords={keywords} />}
        {step === "output" && result && (
          <SignalOutput
            description={description}
            keywords={keywords}
            result={result}
            trendsData={trendsData}
            redditData={redditData}
            onReset={handleReset}
          />
        )}
        {step === "history" && (
          <SignalHistory api={API} onSelect={(s) => {
            setDescription(s.raw_input)
            setKeywords(s.parsed?.keywords || [])
            setResult(s.analysis)
            setTrendsData(s.trends_data || {})
            setRedditData(s.reddit_data || {})
            setStep("output")
          }} />
        )}
      </main>
    </div>
  )
}
