export default function Sidebar({ open, onToggle, history, currentQuery, onNewResearch }) {
  const collapsed = !open

  if (collapsed) {
    return (
      <aside className="sidebar collapsed">
        <div className="sidebar-strip">
          <div className="strip-top">
            {/* Logo icon */}
            <div className="strip-logo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </div>

            {/* Expand sidebar */}
            <button className="strip-btn" onClick={onToggle} title="Open sidebar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>
              </svg>
            </button>

            {/* New research */}
            <button className="strip-btn" onClick={onNewResearch} title="New Research">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
              </svg>
            </button>

            {/* Search */}
            <button className="strip-btn" title="Search sessions">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </button>

            {/* Library */}
            <button className="strip-btn" title="Library">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
          </div>

          <div className="strip-bottom">
            <div className="user-avatar-sm">R</div>
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-logo-wrap">
          <div className="logo-circle">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0D0D0D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <span className="logo-wordmark">ResearchAI</span>
        </div>
        <button className="icon-btn" onClick={onToggle} title="Close sidebar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>
          </svg>
        </button>
      </div>

      <div className="sidebar-nav">
        <button className="nav-item active" onClick={onNewResearch}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
          </svg>
          New Research
        </button>
        <button className="nav-item">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          Search sessions
        </button>
        <button className="nav-item">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
          Library
        </button>
      </div>

      <div className="sidebar-body">
        {history.length > 0 && (
          <div className="sidebar-section-label">Recents</div>
        )}
        {history.length === 0 ? (
          <div className="sidebar-empty">No research sessions yet</div>
        ) : (
          history.map(item => (
            <div
              key={item.id}
              className={`history-item ${item.query === currentQuery ? 'active' : ''}`}
              title={item.query}
            >
              <span className="history-title">{item.query}</span>
            </div>
          ))
        )}
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="user-avatar-sm">R</div>
          <div className="user-name">Rohan</div>
        </div>
      </div>
    </aside>
  )
}
