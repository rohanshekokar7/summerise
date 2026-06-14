import { useState, useRef, useEffect } from 'react'
import Message from './Message.jsx'
import ReportViewer from './ReportViewer.jsx'

const EXAMPLE_PROMPTS = [
  { label: 'AI Agents in 2025', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> },
  { label: 'Quantum Computing Trends', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { label: 'Future of Renewable Energy', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> },
  { label: 'LLM Applications in Healthcare', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12 19.79 19.79 0 0 1 1.91 3.18 2 2 0 0 1 3.9 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9a16 16 0 0 0 6.91 6.91l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> },
]

const STEP_CONFIG = [
  { label: 'Searching Web' },
  { label: 'Reading Sources' },
  { label: 'Analyzing' },
  { label: 'Generating Report' },
]

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

function ProgressTimeline({ currentStep }) {
  const progress = currentStep < 0 ? 0 : currentStep >= 4 ? 100 : ((currentStep + 0.5) / 4) * 100
  const getStatus = (i) => {
    if (currentStep >= 4) return 'done'
    if (i < currentStep) return 'done'
    if (i === currentStep) return 'active'
    return 'pending'
  }
  return (
    <div className="progress-wrap">
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="steps">
        {STEP_CONFIG.map((step, i) => {
          const status = getStatus(i)
          return (
            <div key={i} className={`step ${status}`}>
              <div className={`step-circle ${status}`}>
                {status === 'active' ? <div className="step-spinner" /> : status === 'done' ? <CheckIcon /> : <span style={{ fontSize: 10, fontWeight: 600, color: 'inherit' }}>{i + 1}</span>}
              </div>
              <span className="step-label">{step.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SearchInput({ onSubmit, disabled, placeholder, isFollowup }) {
  const [value, setValue] = useState('')
  const textareaRef = useRef(null)

  const submit = () => {
    const q = value.trim()
    if (!q || disabled) return
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    onSubmit(q)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  const onInput = (e) => {
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  return (
    <div className="search-pill">
      <textarea
        ref={textareaRef}
        rows={1}
        placeholder={placeholder || 'Ask anything'}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onInput={onInput}
        disabled={disabled}
      />
      <div className="search-pill-btns">
        {!isFollowup && (
          <button className="search-icon-btn" title="Attach">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        )}
        <button
          className="search-submit"
          onClick={submit}
          disabled={disabled || !value.trim()}
          title="Send (Enter)"
          style={{ width: 32, height: 32 }}
        >
          {disabled
            ? <span className="spinner" style={{ width: 13, height: 13 }} />
            : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
              </svg>
            )
          }
        </button>
      </div>
    </div>
  )
}

export default function ChatWindow({
  phase, busy, messages, followups, report, currentStep, currentQuery,
  onResearch, onFollowup, onDownload, onCopy,
  onToggleSources, sourcesOpen, sourceCount,
}) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, followups, report])

  return (
    <div className="main-content">
      {/* Header */}
      <div className="header">
        <div className="header-left">
          {currentQuery
            ? <span className="header-query">{currentQuery}</span>
            : <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>ResearchAI</span>
          }
        </div>
        <div className="header-right">
          {sourceCount > 0 && (
            <button className="hbtn" onClick={onToggleSources}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              {sourcesOpen ? 'Hide sources' : `Sources (${sourceCount})`}
            </button>
          )}
          {report && (
            <button className="hbtn" onClick={onDownload}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export
            </button>
          )}
          <div className="user-avatar">R</div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="content-scroll">

        {/* Hero — search is centered here when idle */}
        {phase === 'idle' && messages.length === 0 && (
          <div className="hero">
            <h1 className="hero-title">Research anything, instantly.</h1>
            <div className="hero-search-wrap">
              <SearchInput
                onSubmit={onResearch}
                disabled={busy}
                placeholder="Ask anything"
              />
            </div>
            <div className="hero-chips">
              {EXAMPLE_PROMPTS.map((p, i) => (
                <button key={i} className="prompt-chip" onClick={() => onResearch(p.label)}>
                  {p.icon}
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Progress */}
        {phase === 'busy' && <ProgressTimeline currentStep={currentStep} />}

        {/* Research messages */}
        {messages.length > 0 && (
          <div className="messages">
            {messages.map(msg => <Message key={msg.id} message={msg} />)}
          </div>
        )}

        {/* Inline report */}
        {report && phase === 'done' && (
          <ReportViewer report={report} onDownload={onDownload} onCopy={onCopy} />
        )}

        {/* Follow-up section */}
        {phase === 'done' && (
          <div className="followup-wrap">
            <div className="followup-divider">Follow-up</div>
            {followups.length > 0 && (
              <div className="followup-msgs">
                {followups.map(msg => <Message key={msg.id} message={msg} />)}
              </div>
            )}
            <div style={{ padding: '0 24px' }}>
              <SearchInput onSubmit={onFollowup} disabled={busy} placeholder="Ask a follow-up question..." isFollowup />
            </div>
          </div>
        )}

        <div ref={bottomRef} style={{ height: 8 }} />
      </div>

      {/* Bottom search — only shown when NOT idle */}
      {phase !== 'idle' && (
        <div className="search-wrap">
          <SearchInput
            onSubmit={onResearch}
            disabled={busy}
            placeholder={phase === 'done' ? 'Start a new research session...' : 'Ask anything'}
          />
        </div>
      )}
    </div>
  )
}
