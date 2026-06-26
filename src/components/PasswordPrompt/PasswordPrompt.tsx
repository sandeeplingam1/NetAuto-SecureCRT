import { useState, useRef, useEffect } from 'react'
import { Lock } from 'lucide-react'
import './PasswordPrompt.css'

interface Props {
  sessionName: string
  onSubmit: (password: string) => void
  onCancel: () => void
}

export default function PasswordPrompt({ sessionName, onSubmit, onCancel }: Props) {
  const [pw, setPw] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onCancel])

  return (
    <div className="pw-overlay" onClick={onCancel}>
      <div className="pw-box animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="pw-icon"><Lock size={18} strokeWidth={1.5} /></div>
        <h3 className="pw-title">Authentication Required</h3>
        <p className="pw-sub">Enter password for <strong>{sessionName}</strong></p>
        <input
          ref={inputRef}
          type="password"
          className="pw-input"
          placeholder="Password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSubmit(pw) }}
        />
        <div className="pw-actions">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={() => onSubmit(pw)}>Connect</button>
        </div>
      </div>
    </div>
  )
}
