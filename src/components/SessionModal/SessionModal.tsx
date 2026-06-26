import { useState, useEffect } from 'react'
import { FolderOpen, ChevronDown, ChevronUp, GitBranch, Cpu } from 'lucide-react'
import { useStore, Session, EnvTag, Protocol, AuthMethod, JumpHost } from '../../store/appStore'
import './SessionModal.css'


const EMPTY_FORM: Omit<Session, 'id'> = {
  name: '', host: '', port: 22, username: '',
  protocol: 'SSH', authMethod: 'password',
  password: '', privateKey: '', passphrase: '',
  group: 'Default', env: 'none', notes: '',
  verifyHost: true, keepaliveInterval: 30000,
  agentForwarding: false,
  serialPath: '', baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none',
}

const ENV_OPTS: EnvTag[] = ['none', 'production', 'staging', 'lab', 'dev']
const ENV_COLORS: Record<EnvTag, string> = {
  none: 'var(--text-muted)', production: 'var(--env-prod)',
  staging: 'var(--env-staging)', lab: 'var(--env-lab)', dev: 'var(--env-dev)',
}
const PORT_DEFAULTS: Record<Protocol, number> = { SSH: 22, Telnet: 23, Serial: 0 }
const BAUD_RATES = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400]

export default function SessionModal() {
  const { editingSession, setEditingSession, setShowNewSessionModal, addSession, updateSession } = useStore()
  const api = (window as any).helixAPI

  const isEdit = !!editingSession
  const [form, setForm] = useState<Omit<Session, 'id'>>(editingSession ? { ...editingSession } : EMPTY_FORM)
  const [showPass, setShowPass]         = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showJump, setShowJump]         = useState(!!editingSession?.jumpHost)
  const [showAppearance, setShowAppearance] = useState(false)
  const [serialPorts, setSerialPorts]   = useState<string[]>([])

  const [jumpForm, setJumpForm] = useState<JumpHost>(
    editingSession?.jumpHost || { host: '', port: 22, username: '', password: '' }
  )

  useEffect(() => {
    if (form.protocol === 'Serial') {
      api?.serialList().then((r: any) => {
        if (r?.ports) setSerialPorts(r.ports.map((p: any) => p.path))
      })
    }
  }, [form.protocol])

  const set = (k: keyof typeof form, v: any) => setForm(f => ({ ...f, [k]: v }))
  const setJump = (k: keyof JumpHost, v: any) => setJumpForm(f => ({ ...f, [k]: v }))

  const handleClose = () => { setShowNewSessionModal(false); setEditingSession(null) }

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const handleSave = () => {
    if (!form.name.trim()) return
    if (form.protocol !== 'Serial' && !form.host.trim()) return
    const final = {
      ...form,
      jumpHost: showJump && jumpForm.host ? jumpForm : undefined,
    }
    if (isEdit && editingSession) updateSession(editingSession.id, final)
    else addSession(final)
    handleClose()
  }

  const pickKeyFile = async () => {
    const p = await api?.openFile({
      title: 'Select SSH Private Key',
      filters: [
        { name: 'SSH Keys', extensions: ['pem', 'key', 'ppk', 'rsa', 'ed25519', 'ecdsa'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    if (p) set('privateKey', p)
  }

  const pickJumpKeyFile = async () => {
    const p = await api?.openFile({ title: 'Select Jump Host Key' })
    if (p) setJump('privateKey', p)
  }

  const isSSH    = form.protocol === 'SSH'
  const isTelnet = form.protocol === 'Telnet'
  const isSerial = form.protocol === 'Serial'

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-box animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Session' : 'New Session'}</h2>
          <button className="modal-close" onClick={handleClose}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="modal-body scrollable">

          {/* ── Connection ── */}
          <div className="form-section">
            <div className="form-section-title">Connection</div>
            <div className="form-row">
              <div className="form-field">
                <label>Session Name *</label>
                <input placeholder="e.g. Core Router" value={form.name}
                  onChange={e => set('name', e.target.value)} autoFocus />
              </div>
            </div>

            <div className="form-row two-col">
              <div className="form-field">
                <label>Protocol</label>
                <select value={form.protocol} onChange={e => {
                  const proto = e.target.value as Protocol
                  set('protocol', proto)
                  set('port', PORT_DEFAULTS[proto])
                }}>
                  <option value="SSH">SSH</option>
                  <option value="Telnet">Telnet</option>
                  <option value="Serial">Serial (COM)</option>
                </select>
              </div>
              {!isSerial && (
                <div className="form-field">
                  <label>Port</label>
                  <input type="number" value={form.port}
                    onChange={e => set('port', parseInt(e.target.value) || 22)} />
                </div>
              )}
            </div>

            {!isSerial && (
              <div className="form-row">
                <div className="form-field">
                  <label>Hostname / IP *</label>
                  <input placeholder="192.168.1.1 or router.example.com"
                    value={form.host} onChange={e => set('host', e.target.value)} className="font-mono" />
                </div>
              </div>
            )}

            {isSerial && (
              <div className="form-row two-col">
                <div className="form-field">
                  <label>Serial Port *</label>
                  {serialPorts.length > 0 ? (
                    <select value={form.serialPath}
                      onChange={e => set('serialPath', e.target.value)}>
                      <option value="">Select port…</option>
                      {serialPorts.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  ) : (
                    <input placeholder="/dev/tty.usbserial-0001"
                      value={form.serialPath} onChange={e => set('serialPath', e.target.value)}
                      className="font-mono" />
                  )}
                </div>
                <div className="form-field">
                  <label>Baud Rate</label>
                  <select value={form.baudRate}
                    onChange={e => set('baudRate', parseInt(e.target.value))}>
                    {BAUD_RATES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
            )}

            {isSerial && (
              <div className="form-row three-col">
                <div className="form-field">
                  <label>Data Bits</label>
                  <select value={form.dataBits} onChange={e => set('dataBits', parseInt(e.target.value))}>
                    {[5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Stop Bits</label>
                  <select value={form.stopBits} onChange={e => set('stopBits', parseFloat(e.target.value))}>
                    {[1, 1.5, 2].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Parity</label>
                  <select value={form.parity} onChange={e => set('parity', e.target.value as any)}>
                    <option value="none">None</option>
                    <option value="even">Even</option>
                    <option value="odd">Odd</option>
                  </select>
                </div>
              </div>
            )}

            {(isSSH || isTelnet) && (
              <div className="form-row">
                <div className="form-field">
                  <label>Username</label>
                  <input placeholder="admin" value={form.username}
                    onChange={e => set('username', e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* ── Authentication (SSH only) ── */}
          {isSSH && (
            <div className="form-section">
              <div className="form-section-title">Authentication</div>
              <div className="form-row">
                <div className="form-field">
                  <div className="auth-toggle">
                    {(['password', 'key', 'agent'] as AuthMethod[]).map(m => (
                      <button key={m} className={`auth-btn ${form.authMethod === m ? 'active' : ''}`}
                        onClick={() => set('authMethod', m)}>
                        {m === 'password' ? '🔑 Password' : m === 'key' ? '🗝 Key File' : '🤖 SSH Agent'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {form.authMethod === 'password' && (
                <div className="form-row">
                  <div className="form-field">
                    <label>Password</label>
                    <div className="input-with-btn">
                      <input type={showPass ? 'text' : 'password'}
                        placeholder="Leave empty to prompt on connect"
                        value={form.password} onChange={e => set('password', e.target.value)} />
                      <button className="input-btn" onClick={() => setShowPass(s => !s)}>
                        {showPass ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {form.authMethod === 'key' && (
                <>
                  <div className="form-row">
                    <div className="form-field">
                      <label>Private Key Path</label>
                      <div className="input-with-btn">
                        <input placeholder="~/.ssh/id_rsa" value={form.privateKey}
                          onChange={e => set('privateKey', e.target.value)} className="font-mono" />
                        <button className="input-btn icon-only" onClick={pickKeyFile} title="Browse">
                          <FolderOpen size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-field">
                      <label>Passphrase (if key is encrypted)</label>
                      <input type="password" placeholder="Leave empty if not protected"
                        value={form.passphrase} onChange={e => set('passphrase', e.target.value)} />
                    </div>
                  </div>
                </>
              )}
              {form.authMethod === 'agent' && (
                <div className="form-note">
                  Using SSH agent — make sure your key is added via <code>ssh-add</code>
                </div>
              )}
            </div>
          )}

          {/* ── Jump Host (SSH only) ── */}
          {isSSH && (
            <div className="form-section">
              <button className="section-toggle" onClick={() => setShowJump(v => !v)}>
                <GitBranch size={13} />
                <span>Jump Host / Bastion</span>
                {showJump ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {!showJump && jumpForm.host && <span className="toggle-badge">configured</span>}
              </button>

              {showJump && (
                <div className="section-toggle-body">
                  <div className="form-note">Connect through a bastion/jump host (ProxyJump)</div>
                  <div className="form-row two-col">
                    <div className="form-field">
                      <label>Jump Host</label>
                      <input placeholder="bastion.example.com" value={jumpForm.host}
                        onChange={e => setJump('host', e.target.value)} className="font-mono" />
                    </div>
                    <div className="form-field">
                      <label>Port</label>
                      <input type="number" value={jumpForm.port}
                        onChange={e => setJump('port', parseInt(e.target.value) || 22)} />
                    </div>
                  </div>
                  <div className="form-row two-col">
                    <div className="form-field">
                      <label>Username</label>
                      <input placeholder="ec2-user" value={jumpForm.username}
                        onChange={e => setJump('username', e.target.value)} />
                    </div>
                    <div className="form-field">
                      <label>Password</label>
                      <input type="password" placeholder="or use key below"
                        value={jumpForm.password || ''} onChange={e => setJump('password', e.target.value)} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-field">
                      <label>Jump Host Key (optional)</label>
                      <div className="input-with-btn">
                        <input placeholder="~/.ssh/bastion_key" value={jumpForm.privateKey || ''}
                          onChange={e => setJump('privateKey', e.target.value)} className="font-mono" />
                        <button className="input-btn icon-only" onClick={pickJumpKeyFile}>
                          <FolderOpen size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Advanced SSH Options ── */}
          {isSSH && (
            <div className="form-section">
              <button className="section-toggle" onClick={() => setShowAdvanced(v => !v)}>
                <Cpu size={13} />
                <span>Advanced Options</span>
                {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              {showAdvanced && (
                <div className="section-toggle-body">
                  <div className="form-row two-col">
                    <div className="form-field">
                      <label>Keepalive Interval (ms)</label>
                      <input type="number" min="0" step="5000" value={form.keepaliveInterval}
                        onChange={e => set('keepaliveInterval', parseInt(e.target.value) || 30000)} />
                    </div>
                    <div className="form-field checkbox-field">
                      <label className="checkbox-label">
                        <input type="checkbox" checked={!!form.verifyHost}
                          onChange={e => set('verifyHost', e.target.checked)} />
                        Verify host key
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" checked={!!form.agentForwarding}
                          onChange={e => set('agentForwarding', e.target.checked)} />
                        Agent forwarding
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Appearance ── */}
          <div className="form-section">
            <button className="section-toggle" onClick={() => setShowAppearance(v => !v)}>
              <span>Appearance Override</span>
              {showAppearance ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {showAppearance && (
              <div className="section-toggle-body">
                <div className="form-note">Override global terminal appearance for this session only</div>
                <div className="form-row two-col">
                  <div className="form-field">
                    <label>Font Family</label>
                    <input placeholder="JetBrains Mono" value={form.fontFamily || ''}
                      onChange={e => set('fontFamily', e.target.value)} />
                  </div>
                  <div className="form-field">
                    <label>Font Size</label>
                    <input type="number" min="8" max="24" placeholder="13"
                      value={form.fontSize || ''} onChange={e => set('fontSize', parseInt(e.target.value))} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>Session Color (accent)</label>
                    <div className="color-swatches">
                      {['', '#3b82f6', '#7c3aed', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'].map(c => (
                        <button key={c} className={`color-swatch ${form.color === c ? 'active' : ''}`}
                          style={{ background: c || 'var(--bg-hover)' }}
                          onClick={() => set('color', c)} title={c || 'Default'} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Organization ── */}
          <div className="form-section">
            <div className="form-section-title">Organization</div>
            <div className="form-row">
              <div className="form-field">
                <label>Group / Folder</label>
                <input placeholder="e.g. Production / Core" value={form.group}
                  onChange={e => set('group', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Environment</label>
                <div className="env-options">
                  {ENV_OPTS.map(env => (
                    <button key={env}
                      className={`env-opt ${form.env === env ? 'active' : ''}`}
                      style={{ '--env-color': ENV_COLORS[env], borderLeftWidth: '3px', borderLeftColor: ENV_COLORS[env], borderLeftStyle: 'solid' } as any}
                      onClick={() => set('env', env)}>
                      {env === 'none' ? 'None' : env.charAt(0).toUpperCase() + env.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Notes</label>
                <textarea placeholder="Optional notes about this session…" rows={2}
                  value={form.notes} onChange={e => set('notes', e.target.value)}
                  style={{ resize: 'vertical', minHeight: 52 }} />
              </div>
            </div>
          </div>

        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={handleClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}
            disabled={!form.name.trim() || (!isSerial && !form.host.trim())}>
            {isEdit ? 'Save Changes' : '+ Add Session'}
          </button>
        </div>
      </div>
    </div>
  )
}
