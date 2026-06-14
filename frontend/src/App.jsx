import { useState, useRef, useCallback, useEffect } from 'react'
import './App.css'
import Sidebar from './components/Sidebar.jsx'
import ChatWindow from './components/ChatWindow.jsx'
import SourcePanel from './components/SourcePanel.jsx'

// In dev: empty string (Vite proxy handles /api → localhost:8000)
// In production: set VITE_API_BASE_URL to your Render backend URL
const API = import.meta.env.VITE_API_BASE_URL || ''

let msgId = 0
const uid = () => ++msgId

function parseSSE(raw) {
  const events = []
  for (const line of raw.split('\n')) {
    if (line.startsWith('data: ')) {
      try { events.push(JSON.parse(line.slice(6))) } catch {}
    }
  }
  return events
}

const STEP_TRIGGERS = [
  ['Searching', 'search_result'],
  ['Loading articles', 'Loading:'],
  ['Summarising', 'Summarizing', 'Indexing'],
  ['Generating report'],
]

function statusToStep(msg) {
  for (let i = STEP_TRIGGERS.length - 1; i >= 0; i--) {
    if (STEP_TRIGGERS[i].some(k => msg.includes(k))) return i
  }
  return -1
}

export default function App() {
  const [messages, setMessages]         = useState([])
  const [followups, setFollowups]       = useState([])
  const [sources, setSources]           = useState([])
  const [report, setReport]             = useState(null)
  const [phase, setPhase]               = useState('idle')   // idle | busy | done
  const [currentStep, setCurrentStep]   = useState(-1)
  const [sidebarOpen, setSidebarOpen]   = useState(true)
  const [sourceOpen, setSourceOpen]     = useState(false)
  const [currentQuery, setCurrentQuery] = useState('')
  const [history, setHistory]           = useState(() => {
    try { return JSON.parse(localStorage.getItem('ra_history') || '[]') } catch { return [] }
  })

  const streamingIdRef  = useRef(null)
  const isFollowupRef   = useRef(false)

  const addMsg = useCallback((msg, isFollowup = false) => {
    const item = { id: uid(), ...msg }
    if (isFollowup) setFollowups(p => [...p, item])
    else setMessages(p => [...p, item])
  }, [])

  const appendStreaming = useCallback((id, text, isFollowup) => {
    const update = p => p.map(m => m.id === id ? { ...m, content: m.content + text } : m)
    if (isFollowup) setFollowups(update)
    else setMessages(update)
  }, [])

  const finaliseStreaming = useCallback((id, isFollowup) => {
    const update = p => p.map(m => m.id === id ? { ...m, isStreaming: false } : m)
    if (isFollowup) setFollowups(update)
    else setMessages(update)
    streamingIdRef.current = null
  }, [])

  const handleEvent = useCallback((event) => {
    const fu = isFollowupRef.current
    switch (event.type) {
      case 'status': {
        addMsg({ role: 'system', content: event.message, subtype: 'status' }, fu)
        const step = statusToStep(event.message)
        if (step >= 0) setCurrentStep(step)
        break
      }
      case 'section': {
        addMsg({ role: 'system', content: event.name, subtype: 'section' }, fu)
        const newId = uid()
        streamingIdRef.current = newId
        const item = { id: newId, role: 'assistant', content: '', isStreaming: true }
        if (fu) setFollowups(p => [...p, item])
        else setMessages(p => [...p, item])
        break
      }
      case 'search_result':
        addMsg({ role: 'system', content: event.title, url: event.url, subtype: 'search_result' }, fu)
        setSources(prev => {
          if (prev.find(s => s.url === event.url)) return prev
          return [...prev, { title: event.title, url: event.url, snippet: event.snippet }]
        })
        setCurrentStep(0)
        setSourceOpen(true)
        break
      case 'text':
        if (streamingIdRef.current != null) appendStreaming(streamingIdRef.current, event.content, fu)
        break
      case 'newline':
        if (streamingIdRef.current != null) finaliseStreaming(streamingIdRef.current, fu)
        break
      case 'stored':
        addMsg({ role: 'system', content: `${event.chunks} chunks indexed`, subtype: 'status' }, fu)
        break
      case 'report_saved':
        addMsg({ role: 'system', content: `Report saved`, subtype: 'status' }, fu)
        break
      case 'error':
        addMsg({ role: 'system', content: `Error: ${event.message}`, subtype: 'error' }, fu)
        if (streamingIdRef.current != null) finaliseStreaming(streamingIdRef.current, fu)
        break
      case 'done':
        if (streamingIdRef.current != null) finaliseStreaming(streamingIdRef.current, fu)
        setCurrentStep(4)
        fetch(`${API}/api/report`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data) {
              setReport(data)
              setPhase('done')
              setHistory(prev => {
                const item = { id: uid(), query: data.query, date: new Date().toLocaleString() }
                const next = [item, ...prev].slice(0, 20)
                localStorage.setItem('ra_history', JSON.stringify(next))
                return next
              })
            }
          })
          .catch(() => setPhase('done'))
        break
    }
  }, [addMsg, appendStreaming, finaliseStreaming])

  const streamRequest = useCallback(async (url, body) => {
    try {
      const res = await fetch(`${API}${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Request failed' }))
        addMsg({ role: 'system', content: `Error: ${err.detail}`, subtype: 'error' }, isFollowupRef.current)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop()
        for (const part of parts)
          for (const ev of parseSSE(part + '\n\n')) handleEvent(ev)
      }
      if (buffer.trim()) for (const ev of parseSSE(buffer)) handleEvent(ev)
    } catch (err) {
      addMsg({ role: 'system', content: `Error: ${err.message}`, subtype: 'error' }, isFollowupRef.current)
    }
  }, [addMsg, handleEvent])

  const startResearch = useCallback(async (q) => {
    if (!q.trim()) return
    setMessages([])
    setFollowups([])
    setSources([])
    setReport(null)
    setPhase('busy')
    setCurrentStep(-1)
    setCurrentQuery(q)
    isFollowupRef.current = false
    addMsg({ role: 'user', content: q }, false)
    await streamRequest('/api/research', { query: q, max_articles: 5 })
  }, [addMsg, streamRequest])

  const askFollowup = useCallback(async (question) => {
    if (!question.trim()) return
    isFollowupRef.current = true
    addMsg({ role: 'user', content: question }, true)
    await streamRequest('/api/followup', { question })
    isFollowupRef.current = false
  }, [addMsg, streamRequest])

  const downloadReport = useCallback(async () => {
    const res = await fetch(`${API}/api/report/download`)
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'research_report.md'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const copyReport = useCallback(() => {
    if (report?.report) navigator.clipboard.writeText(report.report).catch(() => {})
  }, [report])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        document.querySelector('.search-inner textarea')?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const busy = phase === 'busy'

  return (
    <div className="app">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        history={history}
        currentQuery={currentQuery}
        onNewResearch={() => { setPhase('idle'); setCurrentQuery(''); setMessages([]); setFollowups([]); setSources([]); setReport(null); setCurrentStep(-1) }}
      />

      <ChatWindow
        phase={phase}
        busy={busy}
        messages={messages}
        followups={followups}
        report={report}
        currentStep={currentStep}
        currentQuery={currentQuery}
        onResearch={startResearch}
        onFollowup={askFollowup}
        onDownload={downloadReport}
        onCopy={copyReport}
        onToggleSources={() => setSourceOpen(o => !o)}
        sourcesOpen={sourceOpen}
        sourceCount={sources.length}
      />

      <SourcePanel
        sources={sources}
        open={sourceOpen}
        onClose={() => setSourceOpen(false)}
      />
    </div>
  )
}
