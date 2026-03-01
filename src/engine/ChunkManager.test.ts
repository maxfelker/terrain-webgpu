import { describe, it, expect, vi, beforeEach } from 'vitest'
import ChunkManager, { CHUNK_SIZE, HEIGHT_SCALE } from './ChunkManager'
import type WasmClient from './WasmClient'
import type { WorldUpdate } from './WasmClient'

// GPUBufferUsage flags needed by ChunkManager
beforeEach(() => {
  if (typeof GPUBufferUsage === 'undefined') {
    Object.defineProperty(globalThis, 'GPUBufferUsage', {
      value: { VERTEX: 0x20, INDEX: 0x10, UNIFORM: 0x40, COPY_DST: 0x8 },
      configurable: true,
    })
  }
})

function makeDestroyable() {
  return { destroy: vi.fn() }
}

function makeFakeDevice() {
  const device = {
    createBuffer: vi.fn(() => ({ ...makeDestroyable() })),
    createBindGroup: vi.fn(() => ({})),
    queue: { writeBuffer: vi.fn() },
  } as unknown as GPUDevice
  return device
}

function makeFakeWasmClient(worldUpdateImpl: () => Promise<WorldUpdate>) {
  return {
    initWorld: vi.fn().mockResolvedValue(undefined),
    worldUpdate: vi.fn(worldUpdateImpl),
    generateChunk: vi.fn().mockResolvedValue({
      heightmap: new Float32Array(129 * 129),
      normals: new Float32Array(129 * 129 * 3),
    }),
  } as unknown as WasmClient
}

function makeFakeBindGroupLayout() {
  return {} as GPUBindGroupLayout
}

// Minimal MeshBuilder mock so tests don't need a real GPU
vi.mock('./MeshBuilder', () => ({
  default: {
    buildVertexBuffer: vi.fn(() => ({ data: new Float32Array(10) })),
    buildIndexBuffer: vi.fn(() => ({ data: new Uint32Array(6), indexCount: 6 })),
  },
}))

describe('ChunkManager.streamUpdate', () => {
  it('adds chunks returned by worldUpdate', async () => {
    const update: WorldUpdate = {
      chunksToAdd: [
        { coord: { X: 0, Z: 0 } },
        { coord: { X: 1, Z: 0 } },
      ],
      chunksToRemove: [],
    }
    const wasmClient = makeFakeWasmClient(() => Promise.resolve(update))
    const device = makeFakeDevice()
    const manager = new ChunkManager(device, wasmClient, makeFakeBindGroupLayout())

    await manager.streamUpdate(256, 256)

    expect(manager.getActiveChunks()).toHaveLength(2)
    expect(manager.getActiveChunks()[0].coord).toEqual({ x: 0, z: 0 })
    expect(manager.getActiveChunks()[1].coord).toEqual({ x: 1, z: 0 })
  })

  it('does not add duplicate chunks', async () => {
    const update: WorldUpdate = {
      chunksToAdd: [{ coord: { X: 0, Z: 0 } }],
      chunksToRemove: [],
    }
    const wasmClient = makeFakeWasmClient(() => Promise.resolve(update))
    const device = makeFakeDevice()
    const manager = new ChunkManager(device, wasmClient, makeFakeBindGroupLayout())

    // Call twice — second call should not add a duplicate
    await manager.streamUpdate(256, 256)
    await manager.streamUpdate(256, 256)

    expect(manager.getActiveChunks()).toHaveLength(1)
  })

  it('removes chunks returned in chunksToRemove', async () => {
    // First call: add chunk (0,0)
    const addUpdate: WorldUpdate = {
      chunksToAdd: [{ coord: { X: 0, Z: 0 } }],
      chunksToRemove: [],
    }
    // Second call: remove chunk (0,0)
    const removeUpdate: WorldUpdate = {
      chunksToAdd: [],
      chunksToRemove: [{ X: 0, Z: 0 }],
    }

    const worldUpdateMock = vi.fn()
      .mockResolvedValueOnce(addUpdate)
      .mockResolvedValueOnce(removeUpdate)

    const wasmClient = makeFakeWasmClient(() => worldUpdateMock())
    const device = makeFakeDevice()
    const manager = new ChunkManager(device, wasmClient, makeFakeBindGroupLayout())

    await manager.streamUpdate(256, 256)
    expect(manager.getActiveChunks()).toHaveLength(1)

    await manager.streamUpdate(5000, 5000)
    expect(manager.getActiveChunks()).toHaveLength(0)
  })

  it('removeChunk destroys GPU buffers', async () => {
    const update: WorldUpdate = {
      chunksToAdd: [{ coord: { X: 2, Z: 3 } }],
      chunksToRemove: [],
    }
    const removeUpdate: WorldUpdate = {
      chunksToAdd: [],
      chunksToRemove: [{ X: 2, Z: 3 }],
    }

    const worldUpdateMock = vi.fn()
      .mockResolvedValueOnce(update)
      .mockResolvedValueOnce(removeUpdate)

    const wasmClient = makeFakeWasmClient(() => worldUpdateMock())
    const device = makeFakeDevice()
    const manager = new ChunkManager(device, wasmClient, makeFakeBindGroupLayout())

    await manager.streamUpdate(256, 256)
    const chunk = manager.getActiveChunks()[0]
    const vb = chunk.vertexBuffer
    const ib = chunk.indexBuffer
    const ub = chunk.uniformBuffer

    await manager.streamUpdate(5000, 5000)

    expect(vb.destroy).toHaveBeenCalled()
    expect(ib.destroy).toHaveBeenCalled()
    expect(ub.destroy).toHaveBeenCalled()
  })
})

describe('ChunkManager.init', () => {
  it('calls initWorld with correct config and triggers streamUpdate at spawn', async () => {
    const update: WorldUpdate = {
      chunksToAdd: [{ coord: { X: 0, Z: 0 } }],
      chunksToRemove: [],
    }
    const wasmClient = makeFakeWasmClient(() => Promise.resolve(update))
    const device = makeFakeDevice()
    const manager = new ChunkManager(device, wasmClient, makeFakeBindGroupLayout())

    await manager.init()

    expect(wasmClient.initWorld).toHaveBeenCalledWith({
      HeightmapResolution: 129,
      Dimension: CHUNK_SIZE,
      Height: HEIGHT_SCALE,
    })
    expect(wasmClient.worldUpdate).toHaveBeenCalledWith(256, 256)
    expect(manager.getActiveChunks().length).toBeGreaterThan(0)
  })
})
