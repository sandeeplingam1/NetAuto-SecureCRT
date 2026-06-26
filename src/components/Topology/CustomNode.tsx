import { Handle, Position } from '@xyflow/react'
import { Server, Router, Shield, Cpu, Activity, CircleOff } from 'lucide-react'
import { DeviceNodeData } from '../../store/topologyStore'
import './TopologyView.css'

function getIcon(platform: string) {
  switch (platform) {
    case 'cisco-ios': return <Router size={16} />
    case 'cisco-nxos': return <Server size={16} />
    case 'arista-eos': return <Server size={16} />
    case 'juniper-junos': return <Router size={16} />
    case 'firewall': return <Shield size={16} />
    default: return <Cpu size={16} />
  }
}

function getStatusIcon(status: string) {
  if (status === 'online') return <Activity size={12} className="status-icon online" />
  if (status === 'offline') return <CircleOff size={12} className="status-icon offline" />
  return <div className="status-icon unknown" />
}

export default function CustomNode({ data }: { data: DeviceNodeData }) {
  return (
    <div className="custom-node">
      {/* Target handle (top) */}
      <Handle type="target" position={Position.Top} className="node-handle" />

      <div className="node-header">
        <div className="node-icon-wrap">
          {getIcon(data.platform)}
        </div>
        <div className="node-title truncate">{data.hostname}</div>
      </div>
      
      <div className="node-body">
        <div className="node-ip">{data.ip}</div>
        <div className="node-status-wrap">
          {getStatusIcon(data.status)}
          <span className="node-status-text">{data.status}</span>
        </div>
      </div>
      
      {data.site && (
        <div className="node-footer truncate">
          {data.site}
        </div>
      )}

      {/* Source handle (bottom) */}
      <Handle type="source" position={Position.Bottom} className="node-handle" />
    </div>
  )
}
