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
      biomeTransition: { primaryBiomeId: 0, secondaryBiomeId: 0, blendFactor: 0 },
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

describe('ChunkManager.reloadChunks', () => {
  it('regenerates active chunks and destroys old GPU buffers', async () => {
    const update: WorldUpdate = {
      chunksToAdd: [{ coord: { X: 2, Z: 3 } }],
      chunksToRemove: [],
    }
    const wasmClient = makeFakeWasmClient(() => Promise.resolve(update))
    const device = makeFakeDevice()
    const manager = new ChunkManager(device, wasmClient, makeFakeBindGroupLayout())

    await manager.streamUpdate(256, 256)
    const oldChunk = manager.getActiveChunks()[0]!

    await manager.reloadChunks(256, 256)

    const reloadedChunk = manager.getActiveChunks()[0]!
    expect(reloadedChunk.coord).toEqual({ x: 2, z: 3 })
    expect(reloadedChunk.vertexBuffer).not.toBe(oldChunk.vertexBuffer)
    expect(reloadedChunk.indexBuffer).not.toBe(oldChunk.indexBuffer)
    expect(reloadedChunk.uniformBuffer).not.toBe(oldChunk.uniformBuffer)
    expect(oldChunk.vertexBuffer.destroy).toHaveBeenCalled()
    expect(oldChunk.indexBuffer.destroy).toHaveBeenCalled()
    expect(oldChunk.uniformBuffer.destroy).toHaveBeenCalled()
    expect(wasmClient.generateChunk).toHaveBeenCalledTimes(2)
  })

  it('falls back to streamUpdate when no chunks are active', async () => {
    const update: WorldUpdate = {
      chunksToAdd: [{ coord: { X: 4, Z: 5 } }],
      chunksToRemove: [],
    }
    const wasmClient = makeFakeWasmClient(() => Promise.resolve(update))
    const device = makeFakeDevice()
    const manager = new ChunkManager(device, wasmClient, makeFakeBindGroupLayout())

    await manager.reloadChunks(1024, 2048)

    expect(wasmClient.worldUpdate).toHaveBeenCalledWith(1024, 2048)
    expect(wasmClient.generateChunk).toHaveBeenCalledTimes(1)
    expect(manager.getActiveChunks()).toHaveLength(1)
    expect(manager.getActiveChunks()[0].coord).toEqual({ x: 4, z: 5 })
  })
})

describe('ChunkManager.generateChunk', () => {
  it('writes biome transition metadata into biomeData uniform vec4', async () => {
    const wasmClient = {
      initWorld: vi.fn().mockResolvedValue(undefined),
      worldUpdate: vi.fn().mockResolvedValue({ chunksToAdd: [], chunksToRemove: [] }),
      generateChunk: vi.fn().mockResolvedValue({
        heightmap: new Float32Array(129 * 129),
        normals: new Float32Array(129 * 129 * 3),
        biomeTransition: { primaryBiomeId: 2, secondaryBiomeId: 5, blendFactor: 0.35 },
      }),
    } as unknown as WasmClient

    const device = makeFakeDevice()
    const manager = new ChunkManager(device, wasmClient, makeFakeBindGroupLayout())

    const chunk = await manager.generateChunk(7, 8)

    const writeCalls = vi.mocked(device.queue.writeBuffer).mock.calls
    const biomeCall = writeCalls.find(([, offset]) => offset === 128)
    expect(biomeCall).toBeDefined()
    const biomeData = biomeCall?.[2] as Float32Array
    expect(biomeData[0]).toBe(2)
    expect(biomeData[1]).toBe(5)
    expect(biomeData[2]).toBeCloseTo(0.35)
    expect(biomeData[3]).toBe(0)

    expect(chunk.biomeTransition).toEqual({
      primaryBiomeId: 2,
      secondaryBiomeId: 5,
      blendFactor: 0.35,
    })
  })
})
