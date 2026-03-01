import { useState, useEffect, useRef } from 'react'

export interface WebGPUState {
  device: GPUDevice | null
  context: GPUCanvasContext | null
  format: GPUTextureFormat | null
  error: string | null
  isReady: boolean
}

export function useWebGPU(canvasRef: React.RefObject<HTMLCanvasElement | null>): WebGPUState {
  const [state, setState] = useState<WebGPUState>({
    device: null,
    context: null,
    format: null,
    error: null,
    isReady: false,
  })
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current || !canvasRef.current) return
    initRef.current = true

    async function init() {
      if (!navigator.gpu) {
        setState(s => ({ ...s, error: 'WebGPU is not supported in this browser. Use Chrome 119+ or Edge 119+.' }))
        return
      }

      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
      if (!adapter) {
        setState(s => ({ ...s, error: 'Failed to get WebGPU adapter.' }))
        return
      }

      const device = await adapter.requestDevice()
      device.lost.then((info) => {
        console.error('[WebGPU] Device lost:', info.message)
        setState(s => ({ ...s, device: null, isReady: false, error: `GPU device lost: ${info.message}` }))
      })

      const canvas = canvasRef.current!
      const context = canvas.getContext('webgpu') as GPUCanvasContext
      const format = navigator.gpu.getPreferredCanvasFormat()
      context.configure({ device, format, alphaMode: 'premultiplied' })

      setState({ device, context, format, error: null, isReady: true })
      console.log('[WebGPU] Device ready:', device.label || 'unnamed')
    }

    init().catch(err => {
      setState(s => ({ ...s, error: String(err) }))
    })
  }, [canvasRef])

  return state
}
