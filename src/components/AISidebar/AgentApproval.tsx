import { useState } from 'react'
import { Play, X, Edit3, ShieldAlert, Check } from 'lucide-react'
import { AgentApprovalItem } from './useAgentLoop'

interface AgentApprovalProps {
  approval: AgentApprovalItem
  onApprove: (cmd?: string) => void
  onReject: () => void
}

export default function AgentApproval({ approval, onApprove, onReject }: AgentApprovalProps) {
  const [editing, setEditing] = useState(false)
  const [cmd, setCmd] = useState(approval.command)

  return (
    <div className="agent-approval animate-fade-in">
      <div className="aa-header">
        <ShieldAlert size={14} className="aa-icon" />
        <span>Agent wants to run a command</span>
      </div>
      
      <div className="aa-reasoning">
        <strong>Reason:</strong> {approval.reasoning}
      </div>

      <div className="aa-cmd-box">
        {editing ? (
          <input
            className="aa-cmd-input"
            value={cmd}
            onChange={e => setCmd(e.target.value)}
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter') onApprove(cmd)
              if (e.key === 'Escape') setEditing(false)
            }}
          />
        ) : (
          <code className="aa-cmd-text">{cmd}</code>
        )}
        {!editing && (
          <button className="aa-edit-btn" onClick={() => setEditing(true)} data-tooltip="Edit command">
            <Edit3 size={12} />
          </button>
        )}
      </div>

      <div className="aa-actions">
        <button className="aa-btn reject" onClick={onReject}>
          <X size={12} /> Reject
        </button>
        {editing ? (
          <button className="aa-btn approve" onClick={() => onApprove(cmd)}>
            <Check size={12} /> Approve Edited
          </button>
        ) : (
          <button className="aa-btn approve" onClick={() => onApprove()}>
            <Play size={12} /> Approve
          </button>
        )}
      </div>
    </div>
  )
}
