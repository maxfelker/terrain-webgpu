import WasmClient from './WasmClient'
import ChunkManager from './ChunkManager'
import createTerrainPipeline from './TerrainPipeline'
import Renderer from './Renderer'
import TextureManager from './TextureManager'
import { extractFrustumPlanes } from './Frustum'
import InputSystem from './InputSystem'
import FPSCamera from './FPSCamera'
import type { PlayerState } from './FPSCamera'
import mat4 from './math/mat4'
import { load } from './Settings'

const FALLBACK_EYE: [number, number, number] = [768, 320, 768]
const FALLBACK_CENTER: [number, number, number] = [256, 0, 256]
const FALLBACK_UP: [number, number, number] = [0, 1, 0]

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
  private inputSystem: InputSystem | null = null
  private fpsCamera: FPSCamera | null = null
  private playerState: PlayerState | null = null
  private lastTimestamp = 0
  private frameCount = 0
  private fps = 0
  private pointerLocked = false
  private fogDensity = load('fogDensity')
  onHudUpdate: ((playerState: PlayerState | null, fps: number) => void) | null = null

  private onPointerLockChange = (): void => {
    const canvas = this.context.canvas as HTMLCanvasElement
    this.pointerLocked = document.pointerLockElement === canvas
  }

  private lastStreamX = 0
  private lastStreamZ = 0

  constructor(device: GPUDevice, context: GPUCanvasContext, format: GPUTextureFormat) {
    this.device = device
    this.context = context
    this.format = format
  }

  async init(): Promise<void> {
    this.wasmClient = new WasmClient()
    await this.wasmClient.ready()

    this.wasmClient.onTick = (state: PlayerState) => {
      this.playerState = state
    }

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

    this.inputSystem = new InputSystem()
    this.fpsCamera = new FPSCamera()
    this.fpsCamera.setFov(load('fov'))
    this.inputSystem.setSensitivity(load('mouseSensitivity') / 0.002)

    const canvas = this.context.canvas as HTMLCanvasElement
    this.inputSystem.attach(canvas)
    document.addEventListener('pointerlockchange', this.onPointerLockChange)
  }

  start(): void {
    this.lastTimestamp = performance.now()
    this.rafId = requestAnimationFrame((t) => this.render(t))
  }

  updateTexture(slot: 'grass' | 'rock', bitmap: ImageBitmap): void {
    this.textureManager?.updateTexture(this.device, slot, bitmap)
  }

  setFogDensity(density: number): void {
    this.fogDensity = density
  }

  setFov(degrees: number): void {
    this.fpsCamera?.setFov(degrees)
  }

  setMouseSensitivity(s: number): void {
    // Normalize relative to physics default of 0.002
    this.inputSystem?.setSensitivity(s / 0.002)
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.inputSystem?.detach()
    document.removeEventListener('pointerlockchange', this.onPointerLockChange)
    if (document.pointerLockElement) document.exitPointerLock()
    this.wasmClient?.terminate()
  }

  private render(timestamp: number): void {
    if (!this.renderer || !this.pipeline || !this.chunkManager || !this.textureManager) return

    let dt = (timestamp - this.lastTimestamp) / 1000
    if (dt > 0.1) dt = 0.1
    this.lastTimestamp = timestamp

    this.frameCount++
    if (this.frameCount % 30 === 0) {
      this.fps = Math.round(1 / dt)
    }

    const canvas = this.context.canvas as HTMLCanvasElement
    const aspect = canvas.width / canvas.height
    this.fpsCamera?.setAspect(aspect)

    if (this.pointerLocked && this.wasmClient && this.inputSystem) {
      const snap = this.inputSystem.flush()
      this.wasmClient.tick(JSON.stringify(snap), dt)
    }

    if (this.playerState) {
      const dx = this.playerState.x - this.lastStreamX
      const dz = this.playerState.z - this.lastStreamZ
      if (dx * dx + dz * dz > 256 * 256) {
        this.lastStreamX = this.playerState.x
        this.lastStreamZ = this.playerState.z
        this.chunkManager?.streamUpdate(this.playerState.x, this.playerState.z)
          .catch(console.error)
      }
    }

    let viewProj: Float32Array
    let eyePos: [number, number, number]

    if (this.playerState && this.fpsCamera) {
      viewProj = this.fpsCamera.getViewProjMatrix(this.playerState)
      eyePos = this.fpsCamera.getEyePosition(this.playerState)
    } else {
      const proj = mat4.perspective(Math.PI / 4, aspect, 0.1, 10000)
      const view = mat4.lookAt(FALLBACK_EYE, FALLBACK_CENTER, FALLBACK_UP)
      viewProj = mat4.multiply(proj, view)
      eyePos = FALLBACK_EYE
    }

    const planes = extractFrustumPlanes(viewProj)
    const visibleChunks = this.chunkManager.filterByFrustum(planes)

    const cameraData = new Float32Array([eyePos[0], eyePos[1], eyePos[2], 0])
    const fogData = new Float32Array([this.fogDensity, 0, 0, 0])

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

    this.onHudUpdate?.(this.playerState, this.fps)

    this.rafId = requestAnimationFrame((t) => this.render(t))
  }
}
