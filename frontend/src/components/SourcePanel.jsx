function getDomain(url) {
  try { return new URL(url).hostname.replace('www.', '') } catch { return url }
}

function getFaviconUrl(url) {
  try { return `https://www.google.com/s2/favicons?sz=32&domain=${new URL(url).hostname}` } catch { return null }
}

function SourceCard({ source }) {
  const domain = getDomain(source.url)
  const favicon = getFaviconUrl(source.url)

  return (
    <a className="source-card" href={source.url} target="_blank" rel="noreferrer">
      <div className="source-card-top">
        <div className="src-favicon">
          {favicon
            ? <img src={favicon} alt="" onError={e => { e.target.style.display = 'none' }} />
            : <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted)' }}><circle cx="12" cy="12" r="10"/></svg>
          }
        </div>
        <span className="src-domain">{domain}</span>
      </div>
      <div className="src-title">{source.title || source.url}</div>
      {source.snippet && <div className="src-snippet">{source.snippet}</div>}
    </a>
  )
}

export default function SourcePanel({ sources, open, onClose }) {
  return (
    <aside className={`source-panel ${open ? '' : 'hidden'}`}>
      <div className="source-panel-head">
        <div className="source-panel-title">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          Sources
          {sources.length > 0 && <span className="src-count">{sources.length}</span>}
        </div>
        <button className="icon-btn" onClick={onClose}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className="source-list">
        {sources.length === 0 ? (
          <div className="source-empty">
            Sources will appear here as research runs
          </div>
        ) : (
          sources.map((s, i) => <SourceCard key={i} source={s} />)
        )}
      </div>
    </aside>
  )
}
