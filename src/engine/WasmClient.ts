// Main-thread async wrapper around the terrain WASM worker.
export default class WasmClient {
  private worker: Worker
  private nextId = 0
  private pending = new Map<number, (data: unknown) => void>()

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
      this.worker.postMessage({ type: 'INIT' })
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
  }

  async generateChunk(
    config: object,
    chunkX: number,
    chunkZ: number,
    resolution: number,
    chunkSize: number,
    heightScale: number,
  ): Promise<{ heightmap: Float32Array; normals: Float32Array }> {
    return this.call(
      'generateChunk',
      [JSON.stringify(config), chunkX, chunkZ, resolution, chunkSize, heightScale],
    ) as Promise<{ heightmap: Float32Array; normals: Float32Array }>
  }

  terminate(): void {
    this.worker.terminate()
  }
}
