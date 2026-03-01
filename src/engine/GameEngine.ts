import WasmClient from './WasmClient'
import ChunkManager from './ChunkManager'
import createTerrainPipeline from './TerrainPipeline'
import Renderer from './Renderer'
import TextureManager from './TextureManager'
import { extractFrustumPlanes } from './Frustum'
import mat4 from './math/mat4'

const CAMERA_EYE: [number, number, number] = [768, 320, 768]
const CAMERA_CENTER: [number, number, number] = [256, 0, 256]
const CAMERA_UP: [number, number, number] = [0, 1, 0]
const FOG_DENSITY = 0.000008

export default class GameEngine {
  private device: GPUDevice
  private context: GPUCanvasContext
  private format: GPUTextureFormat
  private wasmClient: WasmClient | null = null
  private chunkManager: ChunkManager | null = null
  private pipeline: GPURenderPipeline | null = null
  private renderer: Renderer | null = null
  private textureManager: TextureManager | null = null
  private rafId: number | null = null

  constructor(device: GPUDevice, context: GPUCanvasContext, format: GPUTextureFormat) {
    this.device = device
    this.context = context
    this.format = format
  }

  async init(): Promise<void> {
    this.wasmClient = new WasmClient()
    await this.wasmClient.ready()

    this.textureManager = new TextureManager(this.device)

    const { pipeline, bindGroupLayout } = createTerrainPipeline(
      this.device,
      this.format,
      this.textureManager.bindGroupLayout,
    )
    this.pipeline = pipeline

    this.chunkManager = new ChunkManager(this.device, this.wasmClient, bindGroupLayout)
    await this.chunkManager.init()

    this.renderer = new Renderer(this.device, this.context, this.format)
  }

  start(): void {
    this.rafId = requestAnimationFrame((t) => this.render(t))
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.wasmClient?.terminate()
  }

  private render(_timestamp: number): void {
    if (!this.renderer || !this.pipeline || !this.chunkManager || !this.textureManager) return

    const canvas = this.context.canvas as HTMLCanvasElement
    const aspect = canvas.width / canvas.height
    const proj = mat4.perspective(Math.PI / 4, aspect, 0.1, 10000)
    const view = mat4.lookAt(CAMERA_EYE, CAMERA_CENTER, CAMERA_UP)
    const viewProj = mat4.multiply(proj, view)

    const planes = extractFrustumPlanes(viewProj)
    const visibleChunks = this.chunkManager.filterByFrustum(planes)

    const cameraData = new Float32Array([CAMERA_EYE[0], CAMERA_EYE[1], CAMERA_EYE[2], 0])
    const fogData = new Float32Array([FOG_DENSITY, 0, 0, 0])

    for (const chunk of visibleChunks) {
      this.device.queue.writeBuffer(chunk.uniformBuffer, 0, viewProj.buffer as ArrayBuffer, viewProj.byteOffset, viewProj.byteLength)
      this.device.queue.writeBuffer(chunk.uniformBuffer, 80, cameraData)
      this.device.queue.writeBuffer(chunk.uniformBuffer, 96, fogData)
    }

    const { encoder, pass } = this.renderer.beginFrame()
    for (const chunk of visibleChunks) {
      this.renderer.drawChunk(
        pass,
        this.pipeline,
        chunk.bindGroup,
        this.textureManager.bindGroup,
        chunk.vertexBuffer,
        chunk.indexBuffer,
        chunk.indexCount,
      )
    }
    this.renderer.endFrame(encoder, pass)

    this.rafId = requestAnimationFrame((t) => this.render(t))
  }
}
