import { useState } from 'react'

// A term with a dotted underline + ⓘ icon. Hover (desktop) or tap (mobile)
// reveals a small popup with the explanation.
export default function InfoTip({ term, children }) {
  const [open, setOpen] = useState(false)

  return (
    <span
      className="infotip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((o) => !o)}
    >
      <span className="infotip-term">{term}</span>
      <span className="infotip-icon">ⓘ</span>
      {open && <span className="infotip-popup">{children}</span>}
    </span>
  )
}