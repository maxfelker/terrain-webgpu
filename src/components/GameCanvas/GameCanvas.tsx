import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import styles from './GameCanvas.module.css'
import HUD from '../HUD/HUD'
import type { PlayerState } from '../../engine/FPSCamera'

interface GameCanvasProps {
  ref: RefObject<HTMLCanvasElement | null>
  onPointerLock?: (locked: boolean) => void
  playerState?: PlayerState | null
  fps?: number
}

export default function GameCanvas({ ref, onPointerLock, playerState = null, fps = 0 }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return

    function handleClick() {
      canvas!.requestPointerLock()
    }

    function handlePointerLockChange() {
      const locked = document.pointerLockElement === canvas
      onPointerLock?.(locked)
    }

    function handleResize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
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
    <div ref={containerRef} className={styles.wrapper} style={{ position: 'relative' }}>
      <canvas ref={ref} className={styles.canvas} role="presentation" />
      <HUD playerState={playerState} fps={fps} />
    </div>
  )
}
