import WasmClient from './WasmClient'
import ChunkManager from './ChunkManager'
import createTerrainPipeline from './TerrainPipeline'
import Renderer from './Renderer'
import mat4 from './math/mat4'

const CAMERA_EYE: [number, number, number] = [256, 200, 256]
const CAMERA_CENTER: [number, number, number] = [256, 0, 256]
const CAMERA_UP: [number, number, number] = [0, 0, 1]

export default class GameEngine {
  private device: GPUDevice
  private context: GPUCanvasContext
  private format: GPUTextureFormat
  private wasmClient: WasmClient | null = null
  private chunkManager: ChunkManager | null = null
  private pipeline: GPURenderPipeline | null = null
  private renderer: Renderer | null = null
  private rafId: number | null = null

  constructor(device: GPUDevice, context: GPUCanvasContext, format: GPUTextureFormat) {
    this.device = device
    this.context = context
    this.format = format
  }

  async init(): Promise<void> {
    this.wasmClient = new WasmClient()
    await this.wasmClient.ready()

    const { pipeline, bindGroupLayout } = createTerrainPipeline(this.device, this.format)
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
    if (!this.renderer || !this.pipeline || !this.chunkManager) return

    const canvas = this.context.canvas as HTMLCanvasElement
    const aspect = canvas.width / canvas.height
    const proj = mat4.perspective(Math.PI / 4, aspect, 0.1, 10000)
    const view = mat4.lookAt(CAMERA_EYE, CAMERA_CENTER, CAMERA_UP)
    const viewProj = mat4.multiply(proj, view)

    const chunks = this.chunkManager.getActiveChunks()
    for (const chunk of chunks) {
      this.device.queue.writeBuffer(chunk.uniformBuffer, 0, viewProj)
    }

    const { encoder, pass } = this.renderer.beginFrame()
    for (const chunk of chunks) {
      this.renderer.drawChunk(
        pass,
        this.pipeline,
        chunk.bindGroup,
        chunk.vertexBuffer,
        chunk.indexBuffer,
        chunk.indexCount,
      )
    }
    this.renderer.endFrame(encoder, pass)

    this.rafId = requestAnimationFrame((t) => this.render(t))
  }
}
