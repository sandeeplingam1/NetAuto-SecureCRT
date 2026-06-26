import { useState, useEffect } from 'react'
import { Plus, Trash2, Key, Edit3 } from 'lucide-react'
import { useStore, Credential, AuthMethod } from '../../store/appStore'

const api = (window as any).helixAPI

export default function CredentialsVault() {
  const { credentials, addCredential, updateCredential, deleteCredential } = useStore()
  
  const [editingId, setEditingId] = useState<string | null>(null)
  
  // Form state
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [authMethod, setAuthMethod] = useState<AuthMethod>('password')
  const [password, setPassword] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [passphrase, setPassphrase] = useState('')

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setUsername('')
    setAuthMethod('password')
    setPassword('')
    setPrivateKey('')
    setPassphrase('')
  }

  const handleEdit = async (cred: Credential) => {
    setEditingId(cred.id)
    setName(cred.name)
    setUsername(cred.username)
    setAuthMethod(cred.authMethod)
    setPrivateKey(cred.privateKey || '')
    
    // Load secure secrets
    if (api) {
      if (cred.authMethod === 'password') {
        const pw = await api.keychainGet({ account: `cred-${cred.id}` })
        setPassword(pw || '')
      } else if (cred.authMethod === 'key') {
        const pp = await api.keychainGet({ account: `cred-${cred.id}-passphrase` })
        setPassphrase(pp || '')
      }
    }
  }

  const handleSave = async () => {
    if (!name.trim() || !username.trim()) return

    const credData = {
      name: name.trim(),
      username: username.trim(),
      authMethod,
      privateKey: authMethod === 'key' ? privateKey : undefined
    }

    let id = editingId
    if (!id) {
      id = crypto.randomUUID()
      addCredential({ ...credData, id } as any) // we rely on the store to replace the ID anyway if we pass Omit<Credential, 'id'>, wait, store does `id: crypto.randomUUID()`. Let's just pass data and then find the new one by name/username to save password. Or modify `addCredential` to take the full object or we just save keychain using a temporary ID. Wait, if we save keychain *after* the store creates it, we need to know the ID.
      // Actually, it's easier to just pass the ID we generated to `addCredential`, wait `appStore.ts` ignores it.
      // Let's change appStore.ts to use the provided ID if present, otherwise generate one.
    } else {
      updateCredential(id, credData)
    }

    // Securely save secrets
    if (api) {
      if (authMethod === 'password') {
        await api.keychainSave({ account: `cred-${id}`, password })
        await api.keychainDelete({ account: `cred-${id}-passphrase` })
      } else if (authMethod === 'key') {
        await api.keychainSave({ account: `cred-${id}-passphrase`, password: passphrase })
        await api.keychainDelete({ account: `cred-${id}` })
      } else {
        await api.keychainDelete({ account: `cred-${id}` })
        await api.keychainDelete({ account: `cred-${id}-passphrase` })
      }
    }

    resetForm()
  }

  const handleDelete = async (id: string) => {
    deleteCredential(id)
    if (api) {
      await api.keychainDelete({ account: `cred-${id}` })
      await api.keychainDelete({ account: `cred-${id}-passphrase` })
    }
    if (editingId === id) resetForm()
  }

  return (
    <div className="settings-section">
      <h3>Credential Vault</h3>
      <p className="settings-desc">
        Store passwords and SSH keys securely. These credentials can be reused across multiple sessions.
      </p>

      <div className="credentials-list" style={{ marginTop: 20, marginBottom: 20 }}>
        {credentials.length === 0 && <div className="text-muted" style={{ fontSize: 13 }}>No global credentials saved yet.</div>}
        
        {credentials.map(c => (
          <div key={c.id} className="credential-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', padding: 12, borderRadius: 'var(--radius-md)', marginBottom: 8, border: '1px solid var(--border-subtle)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{c.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {c.username} • {c.authMethod === 'password' ? 'Password' : c.authMethod === 'key' ? 'Key File' : 'SSH Agent'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="icon-btn" onClick={() => handleEdit(c)}><Edit3 size={14} /></button>
              <button className="icon-btn" onClick={() => handleDelete(c.id)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      <div className="settings-card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
          {editingId ? 'Edit Credential' : 'New Credential'}
        </div>
        
        <div className="settings-row">
          <label>Name</label>
          <input type="text" className="text-input" placeholder="e.g. Core Routers" value={name} onChange={e => setName(e.target.value)} />
        </div>
        
        <div className="settings-row">
          <label>Username</label>
          <input type="text" className="text-input" placeholder="admin" value={username} onChange={e => setUsername(e.target.value)} />
        </div>

        <div className="settings-row">
          <label>Auth Method</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['password', 'key', 'agent'] as AuthMethod[]).map(m => (
              <button key={m} 
                className={`btn-secondary ${authMethod === m ? 'active' : ''}`}
                style={{ background: authMethod === m ? 'var(--bg-active)' : undefined }}
                onClick={() => setAuthMethod(m)}>
                {m === 'password' ? 'Password' : m === 'key' ? 'Key File' : 'SSH Agent'}
              </button>
            ))}
          </div>
        </div>

        {authMethod === 'password' && (
          <div className="settings-row">
            <label>Password</label>
            <input type="password" className="text-input" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
        )}

        {authMethod === 'key' && (
          <>
            <div className="settings-row">
              <label>Private Key File</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" className="text-input" value={privateKey} onChange={e => setPrivateKey(e.target.value)} style={{ flex: 1 }} />
                <button className="btn-secondary" onClick={async () => {
                  const res = await api?.openFile({ title: 'Select Private Key' })
                  if (!res.cancelled && res.filePaths.length) setPrivateKey(res.filePaths[0])
                }}>Browse</button>
              </div>
            </div>
            <div className="settings-row">
              <label>Passphrase (Optional)</label>
              <input type="password" className="text-input" value={passphrase} onChange={e => setPassphrase(e.target.value)} />
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn-primary" onClick={handleSave}>Save Credential</button>
          {editingId && <button className="btn-secondary" onClick={resetForm}>Cancel</button>}
        </div>
      </div>
    </div>
  )
}
