import WasmClient from './WasmClient'
import type { ChunkCoord } from './worker/WasmBridge'
import MeshBuilder from './MeshBuilder'
import { testAABB } from './Frustum'
import type { Plane } from './Frustum'

export interface ChunkGPUData {
  coord: ChunkCoord
  vertexBuffer: GPUBuffer
  indexBuffer: GPUBuffer
  uniformBuffer: GPUBuffer
  bindGroup: GPUBindGroup
  indexCount: number
  biomeId: number
}

const RESOLUTION = 129
export const CHUNK_SIZE = 512
export const HEIGHT_SCALE = 64
const UNIFORM_BUFFER_SIZE = 144  // 64 (viewProj mat4) + 16 (worldOffset) + 16 (cameraPos) + 16 (fogParams) + 16 padding + 16 (biomeData)

export default class ChunkManager {
  private device: GPUDevice
  private wasmClient: WasmClient
  private bindGroupLayout: GPUBindGroupLayout
  private activeChunks: ChunkGPUData[] = []

  constructor(device: GPUDevice, wasmClient: WasmClient, bindGroupLayout: GPUBindGroupLayout) {
    this.device = device
    this.wasmClient = wasmClient
    this.bindGroupLayout = bindGroupLayout
  }

  async init(): Promise<void> {
    await this.wasmClient.initWorld({
      HeightmapResolution: RESOLUTION,
      Dimension: CHUNK_SIZE,
      Height: HEIGHT_SCALE,
    })
    await this.streamUpdate(256, 256)
  }

  async streamUpdate(playerX: number, playerZ: number): Promise<void> {
    const update = await this.wasmClient.worldUpdate(playerX, playerZ)

    for (const coord of update.chunksToRemove ?? []) {
      this.removeChunk(coord.X, coord.Z)
    }

    const toGenerate = (update.chunksToAdd ?? []).filter(ref => {
      const { X: cx, Z: cz } = ref.coord
      return !this.activeChunks.some(c => c.coord.x === cx && c.coord.z === cz)
    })

    if (toGenerate.length === 0) return

    const newChunks = await Promise.all(
      toGenerate.map(ref => this.generateChunk(ref.coord.X, ref.coord.Z))
    )
    this.activeChunks.push(...newChunks)
  }

  private removeChunk(cx: number, cz: number): void {
    const idx = this.activeChunks.findIndex(c => c.coord.x === cx && c.coord.z === cz)
    if (idx === -1) return
    const chunk = this.activeChunks[idx]
    chunk.vertexBuffer.destroy()
    chunk.indexBuffer.destroy()
    chunk.uniformBuffer.destroy()
    this.activeChunks.splice(idx, 1)
  }

  async generateChunk(cx: number, cz: number): Promise<ChunkGPUData> {
    const { heightmap, normals, biomeId } = await this.wasmClient.generateChunk(
      {}, cx, cz, RESOLUTION, CHUNK_SIZE, HEIGHT_SCALE,
    )

    const { data: vertexData } = MeshBuilder.buildVertexBuffer(
      heightmap, normals, RESOLUTION, CHUNK_SIZE, HEIGHT_SCALE,
    )
    const { data: indexData, indexCount } = MeshBuilder.buildIndexBuffer(RESOLUTION)

    const vertexBuffer = this.device.createBuffer({
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    })
    this.device.queue.writeBuffer(vertexBuffer, 0, vertexData.buffer as ArrayBuffer, vertexData.byteOffset, vertexData.byteLength)

    const indexBuffer = this.device.createBuffer({
      size: indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    })
    this.device.queue.writeBuffer(indexBuffer, 0, indexData.buffer as ArrayBuffer, indexData.byteOffset, indexData.byteLength)

    const uniformBuffer = this.device.createBuffer({
      size: UNIFORM_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    const worldOffset = new Float32Array([cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE, 0])
    this.device.queue.writeBuffer(uniformBuffer, 64, worldOffset)

    const biomeData = new Float32Array([biomeId ?? 0, 0, 0, 0])
    this.device.queue.writeBuffer(uniformBuffer, 128, biomeData)

    const bindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    })

    return {
      coord: { x: cx, z: cz },
      vertexBuffer,
      indexBuffer,
      uniformBuffer,
      bindGroup,
      indexCount,
      biomeId: biomeId ?? 0,
    }
  }

  filterByFrustum(planes: Plane[]): ChunkGPUData[] {
    return this.activeChunks.filter((chunk) => {
      const cx = chunk.coord.x
      const cz = chunk.coord.z
      return testAABB(
        planes,
        cx * CHUNK_SIZE,       -HEIGHT_SCALE, cz * CHUNK_SIZE,
        (cx + 1) * CHUNK_SIZE,  HEIGHT_SCALE, (cz + 1) * CHUNK_SIZE,
      )
    })
  }

  getActiveChunks(): ChunkGPUData[] {
    return this.activeChunks
  }
}
