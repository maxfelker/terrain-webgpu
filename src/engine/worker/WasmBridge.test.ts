import { describe, it, expect, vi, beforeEach } from 'vitest'
import WasmBridge from './WasmBridge'

beforeEach(() => {
  vi.stubGlobal('go_ping', vi.fn().mockReturnValue('pong'))
  vi.stubGlobal('go_initWorld', vi.fn())
  vi.stubGlobal('go_worldUpdate', vi.fn().mockReturnValue('{"chunksToAdd":[],"chunksToRemove":[]}'))
  vi.stubGlobal('go_updatePlayer', vi.fn().mockReturnValue('{"position":[0,0,0],"velocity":[0,0,0],"yaw":0,"pitch":0,"isGrounded":false,"isSprinting":false}'))
  vi.stubGlobal('go_getChunkHeight', vi.fn().mockReturnValue(42.5))
  vi.stubGlobal('go_generateHeightmap', vi.fn().mockReturnValue(new Float32Array(17 * 17)))
  vi.stubGlobal('go_computeNormals', vi.fn().mockReturnValue(new Float32Array(17 * 17 * 3)))
})

describe('WasmBridge', () => {
  it('ping returns pong', () => {
    expect(WasmBridge.ping()).toBe('pong')
  })

  it('worldUpdate returns parsed JSON with expected shape', () => {
    const result = WasmBridge.worldUpdate(0, 0) as { chunksToAdd: unknown[]; chunksToRemove: unknown[] }
    expect(result).toHaveProperty('chunksToAdd')
    expect(result).toHaveProperty('chunksToRemove')
    expect(Array.isArray(result.chunksToAdd)).toBe(true)
  })

  it('getChunkHeight returns a number', () => {
    expect(typeof WasmBridge.getChunkHeight(0, 0)).toBe('number')
  })

  it('initWorld calls go_initWorld with serialized config', () => {
    WasmBridge.initWorld({ seed: 99 })
    expect(vi.mocked(globalThis.go_initWorld)).toHaveBeenCalledWith(JSON.stringify({ seed: 99 }))
  })
})
