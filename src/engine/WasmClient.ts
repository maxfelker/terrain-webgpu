// Main-thread async wrapper around the terrain WASM worker.
import type { PlayerState } from './FPSCamera'
import ChunkWorkerPool from './worker/ChunkWorkerPool'

export interface WorldUpdate {
  chunksToAdd: Array<{ coord: { X: number; Z: number } }> | null
  chunksToRemove: Array<{ X: number; Z: number }> | null
}

export default class WasmClient {
  private worker: Worker
  private nextId = 0
  private pending = new Map<number, (data: unknown) => void>()
  private pool: ChunkWorkerPool | null = null
  private wasmBinaryUrl = ''
  private wasmExecUrl = ''
  onTick: ((playerState: PlayerState) => void) | null = null

  constructor() {
    this.worker = new Worker(
      new URL('./worker/terrain.worker.ts', import.meta.url),
    )
    this.worker.onmessage = (e: MessageEvent) => this.handleMessage(e)
  }

  private handleMessage(e: MessageEvent): void {
    const { type, id, result, error } = e.data
    if (type === 'RESULT' && this.pending.has(id)) {
      const resolve = this.pending.get(id)!
      this.pending.delete(id)
      resolve(error ? Promise.reject(new Error(error)) : result)
    }
    if (type === 'TICK_RESULT') {
      this.onTick?.(e.data.playerState as PlayerState)
    }
  }

  async ready(): Promise<void> {
    return new Promise((resolve, reject) => {
      const handler = (e: MessageEvent) => {
        if (e.data.type === 'READY') {
          this.worker.removeEventListener('message', handler)
          resolve()
        } else if (e.data.type === 'ERROR') {
          this.worker.removeEventListener('message', handler)
          reject(new Error(e.data.message))
        }
      }
      this.worker.addEventListener('message', handler)
      this.worker.postMessage({
        type: 'INIT',
        wasmBinaryUrl: `/terrain.wasm?v=${__WASM_HASH__}`,
        wasmExecUrl: '/wasm_exec.js',
      })
      this.wasmBinaryUrl = `/terrain.wasm?v=${__WASM_HASH__}`
      this.wasmExecUrl = '/wasm_exec.js'
    })
  }

  private call(method: string, args: unknown[], transfer: Transferable[] = []): Promise<unknown> {
    const id = this.nextId++
    return new Promise((resolve) => {
      this.pending.set(id, resolve)
      this.worker.postMessage({ type: 'CALL', id, method, args }, transfer)
    })
  }

  async initWorld(config: object): Promise<void> {
    await this.call('initWorld', [JSON.stringify(config)])
    if (!this.pool && this.wasmBinaryUrl) {
      this.pool = new ChunkWorkerPool(4)
      await this.pool.init(this.wasmBinaryUrl, this.wasmExecUrl, JSON.stringify(config))
    }
  }

  async loadWorldConfig(config: object): Promise<void> {
    await this.call('loadWorldConfig', [JSON.stringify(config)])
  }

  async generateChunk(
    config: object,
    chunkX: number,
    chunkZ: number,
    resolution: number,
    chunkSize: number,
    heightScale: number,
  ): Promise<{ heightmap: Float32Array; normals: Float32Array; biomeId: number }> {
    if (this.pool) {
      const result = await this.pool.generateChunk(
        JSON.stringify(config), chunkX, chunkZ, resolution, chunkSize, heightScale,
      )
      // Register heightmap with primary worker for physics collision.
      // Fire-and-forget: id=-1 is a sentinel never registered in this.pending,
      // so the RESULT response from the worker is silently ignored.
      this.worker.postMessage({
        type: 'CALL',
        id: -1,
        method: 'storeHeightmap',
        args: [chunkX, chunkZ, result.heightmap],
      })
      return result
    }
    return this.call(
      'generateChunk',
      [JSON.stringify(config), chunkX, chunkZ, resolution, chunkSize, heightScale],
    ) as Promise<{ heightmap: Float32Array; normals: Float32Array; biomeId: number }>
  }

  async worldUpdate(playerX: number, playerZ: number): Promise<WorldUpdate> {
    return this.call('worldUpdate', [playerX, playerZ]) as Promise<WorldUpdate>
  }

  terminate(): void {
    this.pool?.terminate()
    this.worker.terminate()
  }

  tick(inputJSON: string, dt: number): void {
    this.worker.postMessage({ type: 'TICK', inputJSON, dt })
  }
}
