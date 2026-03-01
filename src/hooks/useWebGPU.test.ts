import { renderHook, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useWebGPU } from './useWebGPU'

function mockGPU() {
  const mockDevice = {
    lost: new Promise<GPUDeviceLostInfo>(() => {}),
    label: 'mock-device',
  } as unknown as GPUDevice

  const mockContext = {
    configure: vi.fn(),
  } as unknown as GPUCanvasContext

  const mockCanvas = {
    getContext: vi.fn().mockReturnValue(mockContext),
  } as unknown as HTMLCanvasElement

  const mockAdapter = {
    requestDevice: vi.fn().mockResolvedValue(mockDevice),
  } as unknown as GPUAdapter

  Object.defineProperty(navigator, 'gpu', {
    configurable: true,
    value: {
      requestAdapter: vi.fn().mockResolvedValue(mockAdapter),
      getPreferredCanvasFormat: vi.fn().mockReturnValue('bgra8unorm'),
    },
  })

  return { mockCanvas, mockDevice, mockContext }
}

describe('useWebGPU', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error state when WebGPU is unavailable', async () => {
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined })
    const ref = createRef<HTMLCanvasElement>()
    Object.defineProperty(ref, 'current', { value: document.createElement('canvas') })

    const { result } = renderHook(() => useWebGPU(ref))

    await waitFor(() => {
      expect(result.current.error).toContain('WebGPU not supported')
    })
    expect(result.current.isReady).toBe(false)
  })

  it('initial state is not ready with no error', () => {
    const ref = createRef<HTMLCanvasElement>()
    const { result } = renderHook(() => useWebGPU(ref))
    expect(result.current.isReady).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('returns ready state when WebGPU is available', async () => {
    const { mockCanvas } = mockGPU()
    const ref = createRef<HTMLCanvasElement>()
    Object.defineProperty(ref, 'current', { value: mockCanvas })

    const { result } = renderHook(() => useWebGPU(ref))

    await waitFor(() => {
      expect(result.current.isReady).toBe(true)
    })
    expect(result.current.error).toBeNull()
  })
})
