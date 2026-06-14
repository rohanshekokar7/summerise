import { marked } from 'marked'

marked.setOptions({ breaks: true, gfm: true })

export default function Message({ message }) {
  const { role, content, subtype, url, isStreaming } = message

  if (subtype === 'section') {
    return <div className="section-divider">{content?.toUpperCase()}</div>
  }

  if (subtype === 'search_result') {
    return (
      <div className="msg-search">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--muted)' }}>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <a href={url} target="_blank" rel="noreferrer">{content || url}</a>
      </div>
    )
  }

  if (role === 'system') {
    return (
      <div className={`msg-status ${subtype === 'error' ? 'error' : ''}`}>
        <div className="status-ping" />
        {content}
      </div>
    )
  }

  if (role === 'user') {
    return (
      <div className="msg-user">
        <div className="msg-user-bubble">{content}</div>
      </div>
    )
  }

  const html = marked.parse(content || '')

  return (
    <div className="msg-ai">
      <div className="ai-avatar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#212121" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
      </div>
      <div className="msg-ai-bubble" dangerouslySetInnerHTML={{ __html: html }} />
      {isStreaming && <span className="cursor-blink" />}
    </div>
  )
}
