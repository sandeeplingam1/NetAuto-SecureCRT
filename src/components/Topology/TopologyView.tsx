import { useCallback, useState } from 'react'
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  BackgroundVariant,
  Panel
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Network, Plus, Trash2 } from 'lucide-react'
import { useTopologyStore } from '../../store/topologyStore'
import CustomNode from './CustomNode'
import './TopologyView.css'

const nodeTypes = {
  device: CustomNode
}

export default function TopologyView() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, clearTopology } = useTopologyStore()
  
  // Local state for the "Add Node" quick form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newHostname, setNewHostname] = useState('')
  const [newIp, setNewIp] = useState('')

  const handleAddNode = () => {
    if (!newHostname) return
    addNode({
      hostname: newHostname,
      ip: newIp || '0.0.0.0',
      platform: 'generic',
      site: 'Local Site'
    })
    setNewHostname('')
    setNewIp('')
    setShowAddForm(false)
  }

  return (
    <div className="topology-view">
      <div className="topology-header">
        <div className="topology-title">
          <Network size={16} className="text-blue-500" />
          Live Topology Map
        </div>
        <div className="topology-actions">
          <button 
            className="btn-secondary" 
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus size={14} /> Add Node
          </button>
          <button 
            className="btn-secondary text-red-500" 
            onClick={clearTopology}
            title="Clear Topology"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="topology-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="dark"
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="var(--border)" />
          <Controls />
          <MiniMap 
            nodeColor={(n) => {
              if (n.data?.status === 'online') return 'var(--accent-green)'
              if (n.data?.status === 'offline') return 'var(--accent-red)'
              return 'var(--text-muted)'
            }} 
          />
          
          {showAddForm && (
            <Panel position="top-right" className="bg-elevated border rounded p-3 shadow-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
              <div className="text-sm font-semibold mb-2">Add Device</div>
              <input 
                autoFocus
                type="text" 
                placeholder="Hostname" 
                className="mb-2"
                value={newHostname}
                onChange={e => setNewHostname(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddNode()}
              />
              <input 
                type="text" 
                placeholder="IP Address" 
                className="mb-3"
                value={newIp}
                onChange={e => setNewIp(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddNode()}
              />
              <div className="flex gap-2">
                <button className="btn-primary flex-1" onClick={handleAddNode}>Add</button>
                <button className="btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>
    </div>
  )
}
