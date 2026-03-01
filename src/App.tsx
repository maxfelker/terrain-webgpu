import { useRef, useState, useEffect } from 'react'
import GameCanvas from './components/GameCanvas/GameCanvas'
import { useWebGPU } from './hooks/useWebGPU'
import GameEngine from './engine/GameEngine'
import type { PlayerState } from './engine/FPSCamera'
import styles from './App.module.css'

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pointerLocked, setPointerLocked] = useState(false)
  const [playerState, setPlayerState] = useState<PlayerState | null>(null)
  const [fps, setFps] = useState(0)
  const { device, context, format, error, isReady } = useWebGPU(canvasRef)
  const engineStarted = useRef(false)

  useEffect(() => {
    if (!isReady || !device || !context || !format) return
    if (engineStarted.current) return
    engineStarted.current = true

    const engine = new GameEngine(device, context, format)
    engine.onHudUpdate = (ps, f) => {
      setPlayerState(ps)
      setFps(f)
    }
    engine.init().then(() => engine.start())

    return () => { engine.stop() }
  }, [isReady, device, context, format])

  return (
    <>
      {error && <div className={styles.errorOverlay}>{error}</div>}
      <GameCanvas ref={canvasRef} onPointerLock={setPointerLocked} playerState={playerState} fps={fps} />
      <div className={styles.status}>
        {isReady ? '✓ WebGPU Ready' : 'Initializing WebGPU...'}
        {pointerLocked && ' | Click to unlock'}
      </div>
    </>
  )
}
