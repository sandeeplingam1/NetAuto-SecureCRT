import { useRef, useState, useCallback, useEffect } from 'react'
import './SplitView.css'

interface ResizableSplitProps {
  direction: 'horizontal' | 'vertical'
  children: [React.ReactNode, React.ReactNode]
  initialRatio?: number // 0–100
}

export default function ResizableSplit({ direction, children, initialRatio = 50 }: ResizableSplitProps) {
  const [ratio, setRatio] = useState(initialRatio)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    let pct: number
    if (direction === 'horizontal') {
      pct = ((e.clientX - rect.left) / rect.width) * 100
    } else {
      pct = ((e.clientY - rect.top) / rect.height) * 100
    }
    setRatio(Math.min(85, Math.max(15, pct)))
  }, [isDragging, direction])

  const onMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    } else {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [isDragging, onMouseMove, onMouseUp])

  const isH = direction === 'horizontal'
  const firstStyle = isH
    ? { width: `${ratio}%`, minWidth: 0 }
    : { height: `${ratio}%`, minHeight: 0 }
  const secondStyle = isH
    ? { width: `${100 - ratio}%`, minWidth: 0 }
    : { height: `${100 - ratio}%`, minHeight: 0 }

  return (
    <div
      ref={containerRef}
      className={`resizable-split resizable-split-${direction} ${isDragging ? 'dragging' : ''}`}
    >
      <div className="resizable-child" style={firstStyle}>
        {children[0]}
      </div>
      <div
        className={`split-divider split-divider-${direction}`}
        onMouseDown={startDrag}
      >
        <div className="split-divider-handle" />
      </div>
      <div className="resizable-child" style={secondStyle}>
        {children[1]}
      </div>
    </div>
  )
}
