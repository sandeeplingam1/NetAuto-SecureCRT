import { useState, useEffect, useRef } from 'react'
import { Shield, AlertTriangle, X } from 'lucide-react'
import { useStore } from '../../store/appStore'
import './SSHDialogs.css'

const api = (window as any).helixAPI

// ── Host Key Dialog ───────────────────────────────────────────────────────────
export function HostKeyDialog() {
  const { hostKeyEvent, setHostKeyEvent } = useStore()
  if (!hostKeyEvent) return null
  const { id, host, port, fingerprint, stored } = hostKeyEvent
  const isChanged = !!stored

  const trust = () => {
    api?.replySSHTrustHost(id, true)
    setHostKeyEvent(null)
  }
  const reject = () => {
    api?.replySSHTrustHost(id, false)
    setHostKeyEvent(null)
  }

  return (
    <div className="ssh-dialog-overlay">
      <div className={`ssh-dialog ${isChanged ? 'danger' : 'warn'} animate-fade-in`}>
        <div className="ssh-dialog-icon">
          {isChanged ? <AlertTriangle size={22} /> : <Shield size={22} />}
        </div>
        <h3>{isChanged ? 'Host Key Changed!' : 'Unknown Host'}</h3>
        <div className="ssh-dialog-host">{host}:{port}</div>

        {isChanged ? (
          <p className="ssh-dialog-msg danger-text">
            The host key for this server has <strong>changed</strong> since your last connection.
            This may indicate a man-in-the-middle attack. Do NOT connect unless you know why the key changed.
          </p>
        ) : (
          <p className="ssh-dialog-msg">
            The authenticity of host <strong>{host}</strong> can't be established.
            This is your first connection to this server.
          </p>
        )}

        <div className="ssh-fingerprint">
          <div className="fp-label">SHA-256 Fingerprint</div>
          <div className="fp-value font-mono">{fingerprint.match(/.{1,8}/g)?.join(':')}</div>
        </div>

        <div className="ssh-dialog-actions">
          <button className="btn-secondary" onClick={reject}>
            <X size={13} /> Reject
          </button>
          {!isChanged && (
            <button className="btn-primary" onClick={trust}>
              <Shield size={13} /> Trust & Connect
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Keyboard Interactive Dialog (MFA / OTP / Challenge) ──────────────────────
export function KeyboardInteractiveDialog() {
  const { kbInteractive, setKbInteractive } = useStore()
  const [responses, setResponses] = useState<string[]>([])
  const firstRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (kbInteractive) {
      setResponses(kbInteractive.prompts.map(() => ''))
      setTimeout(() => firstRef.current?.focus(), 50)
    }
  }, [kbInteractive])

  if (!kbInteractive) return null

  const submit = () => {
    api?.replySSHKeyboardInteractive(kbInteractive.id, responses)
    setKbInteractive(null)
  }

  return (
    <div className="ssh-dialog-overlay">
      <div className="ssh-dialog animate-fade-in">
        <div className="ssh-dialog-icon warn"><Shield size={22} /></div>
        <h3>Authentication Required</h3>
        <p className="ssh-dialog-msg">The server requires additional authentication.</p>

        <div className="kb-prompts">
          {kbInteractive.prompts.map((p, i) => (
            <div key={i} className="kb-prompt">
              <label>{p.prompt.trim() || 'Response'}</label>
              <input
                ref={i === 0 ? firstRef : undefined}
                type={p.echo ? 'text' : 'password'}
                value={responses[i] || ''}
                onChange={e => setResponses(r => r.map((v, j) => j === i ? e.target.value : v))}
                onKeyDown={e => { if (e.key === 'Enter' && i === kbInteractive.prompts.length - 1) submit() }}
                className="font-mono"
              />
            </div>
          ))}
        </div>

        <div className="ssh-dialog-actions">
          <button className="btn-secondary" onClick={() => { api?.replySSHKeyboardInteractive(kbInteractive.id, []); setKbInteractive(null) }}>
            Cancel
          </button>
          <button className="btn-primary" onClick={submit}>Submit</button>
        </div>
      </div>
    </div>
  )
}
