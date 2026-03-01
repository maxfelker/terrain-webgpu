import WasmClient from './WasmClient'
import type { ChunkCoord } from './worker/WasmBridge'
import MeshBuilder from './MeshBuilder'

export interface ChunkGPUData {
  coord: ChunkCoord
  vertexBuffer: GPUBuffer
  indexBuffer: GPUBuffer
  uniformBuffer: GPUBuffer
  bindGroup: GPUBindGroup
  indexCount: number
}

const RESOLUTION = 129
const CHUNK_SIZE = 512
const HEIGHT_SCALE = 64
const UNIFORM_BUFFER_SIZE = 96  // 64 (viewProj mat4) + 16 (worldOffset vec4) + 16 padding

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
    await this.wasmClient.initWorld({})
    const chunk = await this.generateChunk(0, 0)
    this.activeChunks.push(chunk)
  }

  async generateChunk(cx: number, cz: number): Promise<ChunkGPUData> {
    const heightmap = await this.wasmClient.generateHeightmap({}, cx, cz)
    const normals = await this.wasmClient.computeNormals(heightmap, RESOLUTION, CHUNK_SIZE, HEIGHT_SCALE)

    const { data: vertexData } = MeshBuilder.buildVertexBuffer(
      heightmap, normals, RESOLUTION, CHUNK_SIZE, HEIGHT_SCALE,
    )
    const { data: indexData, indexCount } = MeshBuilder.buildIndexBuffer(RESOLUTION)

    const vertexBuffer = this.device.createBuffer({
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    })
    this.device.queue.writeBuffer(vertexBuffer, 0, vertexData)

    const indexBuffer = this.device.createBuffer({
      size: indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    })
    this.device.queue.writeBuffer(indexBuffer, 0, indexData)

    const uniformBuffer = this.device.createBuffer({
      size: UNIFORM_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    const worldOffset = new Float32Array([cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE, 0])
    this.device.queue.writeBuffer(uniformBuffer, 64, worldOffset)

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
    }
  }

  getActiveChunks(): ChunkGPUData[] {
    return this.activeChunks
  }
}
