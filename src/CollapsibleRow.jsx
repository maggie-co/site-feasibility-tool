import { useState } from 'react'

// A left-justified row with a carrot. Label + inline value always show.
// Clicking toggles an indented detail block (children) below it.
// If there's no detail (no children), the carrot is hidden and it's a plain row.
export default function CollapsibleRow({ label, value, children }) {
  const [open, setOpen] = useState(false)
  // Only show a carrot if there's real content to expand.
  // Filters out null, undefined, false, and empty fragments.
  const hasDetail =
    children != null &&
    children !== false &&
    !(Array.isArray(children) && children.every((c) => c == null || c === false))

  return (
    <div className="crow">
      <button
        className="crow-header"
        onClick={() => hasDetail && setOpen((o) => !o)}
        style={{ cursor: hasDetail ? 'pointer' : 'default' }}
      >
        <span className={`crow-carrot ${hasDetail ? '' : 'crow-carrot-hidden'}`}>
          {open ? '▾' : '▸'}
        </span>
        <span className="crow-label">{label}</span>
        {value && <span className="crow-value">{value}</span>}
      </button>

      {open && hasDetail && <div className="crow-detail">{children}</div>}
    </div>
  )
}