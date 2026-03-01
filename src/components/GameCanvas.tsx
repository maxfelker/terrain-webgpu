import { useEffect, useRef, forwardRef } from 'react'

interface GameCanvasProps {
  onPointerLock?: (locked: boolean) => void
}

const GameCanvas = forwardRef<HTMLCanvasElement, GameCanvasProps>(
  ({ onPointerLock }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      const canvas = (ref as React.RefObject<HTMLCanvasElement>)?.current
      if (!canvas) return

      const handleClick = () => {
        canvas.requestPointerLock()
      }

      const handlePointerLockChange = () => {
        const locked = document.pointerLockElement === canvas
        onPointerLock?.(locked)
      }

      const handleResize = () => {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
      }

      handleResize()
      canvas.addEventListener('click', handleClick)
      document.addEventListener('pointerlockchange', handlePointerLockChange)
      window.addEventListener('resize', handleResize)

      return () => {
        canvas.removeEventListener('click', handleClick)
        document.removeEventListener('pointerlockchange', handlePointerLockChange)
        window.removeEventListener('resize', handleResize)
      }
    }, [ref, onPointerLock])

    return (
      <div ref={containerRef} style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#000' }}>
        <canvas
          ref={ref}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </div>
    )
  }
)

GameCanvas.displayName = 'GameCanvas'
export default GameCanvas
