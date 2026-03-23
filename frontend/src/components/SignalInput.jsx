import { useState } from "react"

const EXAMPLES = [
  "Girls are wearing bows in their hair again — seeing it everywhere on niche TikTok corners, started maybe 3 weeks ago",
  "There's a growing discourse on X about people quitting streaming and going back to buying physical media",
  "I keep seeing 'raw dogging' flights content blow up — people bragging about sitting with nothing for hours",
  "Micro-communities on Reddit organizing around 'no phone dinner' challenges — bleeding into mainstream parenting forums"
]

export default function SignalInput({ onSubmit, loading }) {
  const [value, setValue] = useState("")

  return (
    <div className="input-view">
      <div className="input-hero">
        <div className="input-eyebrow">Signal capture</div>
        <h1 className="input-heading">What are you seeing?</h1>
        <p className="input-sub">
          Describe a cultural observation, behavior pattern, or discourse shift you've noticed.
          Be specific — the texture of the detail matters.
        </p>
      </div>

      <div className="input-field-wrap">
        <textarea
          className="input-field"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && value.trim() && !loading) {
              onSubmit(value.trim())
            }
          }}
          placeholder="e.g. I keep seeing girls on TikTok doing this specific hand gesture when unboxing beauty products. Started in niche corners about 3 weeks ago and now bleeding into mainstream accounts..."
          rows={6}
          disabled={loading}
          autoFocus
        />
        <div className="input-actions">
          <span className="input-hint">⌘ + Enter to continue</span>
          <button
            className="input-btn"
            disabled={loading || !value.trim()}
            onClick={() => value.trim() && onSubmit(value.trim())}
          >
            {loading ? (
              <span className="btn-loading">
                <span className="btn-spinner" />
                Generating keywords...
              </span>
            ) : "Continue →"}
          </button>
        </div>
      </div>

      <div className="examples">
        <div className="examples-label">Try an example</div>
        <div className="examples-grid">
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              className="example-item"
              onClick={() => setValue(ex)}
              disabled={loading}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
