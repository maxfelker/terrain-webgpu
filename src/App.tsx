import { useRef, useState, useEffect } from 'react'
import GameCanvas from './components/GameCanvas/GameCanvas'
import { useWebGPU } from './hooks/useWebGPU'
import renderHelloTriangle from './engine/HelloTriangle'
import styles from './App.module.css'

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pointerLocked, setPointerLocked] = useState(false)
  const { device, context, format, error, isReady } = useWebGPU(canvasRef)
  const triangleStarted = useRef(false)

  useEffect(() => {
    if (!isReady || !device || !context || !format) return
    if (triangleStarted.current) return
    triangleStarted.current = true
    renderHelloTriangle(device, context, format)
  }, [isReady, device, context, format])

  return (
    <>
      {error && <div className={styles.errorOverlay}>{error}</div>}
      <GameCanvas ref={canvasRef} onPointerLock={setPointerLocked} />
      <div className={styles.status}>
        {isReady ? '✓ WebGPU Ready' : 'Initializing WebGPU...'}
        {pointerLocked && ' | Click to unlock'}
      </div>
    </>
  )
}
