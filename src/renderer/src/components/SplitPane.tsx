import React, { useCallback, useRef, useState } from 'react'

interface SplitPaneProps {
  left: React.ReactNode
  right: React.ReactNode
  defaultLeftWidth?: number  // percentage 0-100
  minLeftWidth?: number      // px
  minRightWidth?: number     // px
}

export function SplitPane({
  left,
  right,
  defaultLeftWidth = 28,
  minLeftWidth = 180,
  minRightWidth = 320
}: SplitPaneProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth) // %
  const isDragging = useRef(false)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDragging.current = true
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const onMouseMove = (ev: MouseEvent): void => {
        if (!isDragging.current || !containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        const totalWidth = rect.width
        const newLeft = ev.clientX - rect.left
        const clampedLeft = Math.max(minLeftWidth, Math.min(newLeft, totalWidth - minRightWidth - 4))
        setLeftWidth((clampedLeft / totalWidth) * 100)
      }

      const onMouseUp = (): void => {
        isDragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [minLeftWidth, minRightWidth]
  )

  return (
    <div ref={containerRef} className="flex h-full overflow-hidden">
      {/* Left pane */}
      <div
        className="flex flex-col overflow-hidden border-r border-surface-800"
        style={{ width: `${leftWidth}%`, flexShrink: 0 }}
      >
        {left}
      </div>

      {/* Resizer */}
      <div
        className="resizer flex items-center justify-center group"
        onMouseDown={onMouseDown}
      >
        <div className="w-0.5 h-8 rounded-full bg-surface-700 group-hover:bg-accent-400/60 transition-colors" />
      </div>

      {/* Right pane */}
      <div className="flex flex-col flex-1 overflow-hidden">{right}</div>
    </div>
  )
}
