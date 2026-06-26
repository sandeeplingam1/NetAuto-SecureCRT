import { useState, useEffect, useRef } from 'react'
import { Lock, Unlock } from 'lucide-react'
import { useStore } from '../../store/appStore'
import './LockScreen.css'

export default function LockScreen() {
  const { isLocked, unlockSession, lockPin } = useStore()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isLocked) {
      setPin('')
      setError(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isLocked])

  if (!isLocked) return null

  const tryUnlock = () => {
    const ok = unlockSession(pin)
    if (!ok) { setError(true); setPin(''); setTimeout(() => setError(false), 800) }
  }

  return (
    <div className="lock-screen">
      <div className={`lock-box animate-fade-in ${error ? 'shake' : ''}`}>
        <div className="lock-icon"><Lock size={28} strokeWidth={1.5} /></div>
        <h2>Helix Locked</h2>
        <p>Enter your PIN to unlock</p>
        <input
          ref={inputRef}
          type="password"
          className="lock-pin-input font-mono"
          placeholder={lockPin ? '••••' : 'Press Enter to unlock'}
          value={pin}
          onChange={e => setPin(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') tryUnlock() }}
          maxLength={32}
        />
        {error && <div className="lock-error">Incorrect PIN</div>}
        <button className="btn-primary lock-btn" onClick={tryUnlock}>
          <Unlock size={14} /> Unlock
        </button>
      </div>
    </div>
  )
}
