import { marked } from 'marked'

marked.setOptions({ breaks: true, gfm: true })

export default function ReportViewer({ report, onDownload, onCopy }) {
  const html = marked.parse(report.report || '')

  return (
    <div className="report-section">
      <div className="report-hero">
        <div>
          <div className="report-icon-wrap">
            <div className="report-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <span className="report-label">Research Report</span>
          </div>
          <div className="report-title">{report.query}</div>
          <div className="report-meta">AI-generated · Based on web research</div>
        </div>
        <div className="report-actions">
          <button className="ra-btn" onClick={onCopy}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy
          </button>
          <button className="ra-btn primary" onClick={onDownload}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export .md
          </button>
        </div>
      </div>

      <div className="report-body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
