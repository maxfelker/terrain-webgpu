import { useRef, useState, useEffect } from 'react'
import GameCanvas from './components/GameCanvas'
import { useWebGPU } from './hooks/useWebGPU'
import { renderHelloTriangle } from './engine/HelloTriangle'
import './App.css'

function App() {
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
      {error && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#0a0a0a', color: '#ff4444', fontFamily: 'monospace',
          fontSize: '1.2rem', padding: '2rem', textAlign: 'center', zIndex: 100
        }}>
          {error}
        </div>
      )}
      <GameCanvas ref={canvasRef} onPointerLock={setPointerLocked} />
      <div style={{
        position: 'fixed', bottom: 16, left: 16,
        color: '#aaa', fontFamily: 'monospace', fontSize: '0.75rem',
        pointerEvents: 'none', userSelect: 'none',
      }}>
        {isReady ? '✓ WebGPU Ready' : 'Initializing WebGPU...'}
        {pointerLocked && ' | Click to unlock'}
      </div>
    </>
  )
}

export default App
