// Pool of WASM workers dedicated to chunk generation.
// Each worker has its own WASM instance and only handles generateChunk calls.
// Routes calls round-robin to minimize latency compared to a single-worker queue.

interface PendingCall {
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}

interface PoolWorker {
  worker: Worker
  pending: Map<number, PendingCall>
  nextId: number
  ready: boolean
}

export default class ChunkWorkerPool {
  private workers: PoolWorker[] = []
  private roundRobinIndex = 0
  private readonly size: number

  constructor(size = 4) {
    this.size = size
  }

  async init(wasmBinaryUrl: string, wasmExecUrl: string, worldConfigJSON: string): Promise<void> {
    const readyPromises = Array.from({ length: this.size }, () => {
      return new Promise<void>((resolve, reject) => {
        const worker = new Worker(
          new URL('./terrain.worker.ts', import.meta.url),
        )
        const pw: PoolWorker = { worker, pending: new Map(), nextId: 0, ready: false }
        this.workers.push(pw)

        worker.onmessage = (e: MessageEvent) => {
          const { type, id, result, error } = e.data
          if (type === 'READY') {
            const cfgId = pw.nextId++
            pw.pending.set(cfgId, {
              resolve: () => {
                pw.ready = true
                resolve()
              },
              reject,
            })
            worker.postMessage({ type: 'CALL', id: cfgId, method: 'loadWorldConfig', args: [worldConfigJSON] })
          } else if (type === 'RESULT') {
            const pending = pw.pending.get(id)
            if (pending) {
              pw.pending.delete(id)
              if (error) pending.reject(new Error(error))
              else pending.resolve(result)
            }
          } else if (type === 'ERROR') {
            reject(new Error(e.data.message))
          }
        }

        worker.postMessage({ type: 'INIT', wasmBinaryUrl, wasmExecUrl })
      })
    })

    await Promise.all(readyPromises)
  }

  async updateWorldConfig(worldConfigJSON: string): Promise<void> {
    await Promise.all(this.workers.map(pw => this.callWorker(pw, 'loadWorldConfig', [worldConfigJSON])))
  }

  generateChunk(
    configJSON: string,
    cx: number,
    cz: number,
    resolution: number,
    chunkSize: number,
    heightScale: number,
  ): Promise<{ heightmap: Float32Array; normals: Float32Array; biomeId: number }> {
    const pw = this.workers[this.roundRobinIndex % this.workers.length]
    this.roundRobinIndex++
    return this.callWorker(pw, 'generateChunk', [configJSON, cx, cz, resolution, chunkSize, heightScale]) as Promise<{ heightmap: Float32Array; normals: Float32Array; biomeId: number }>
  }

  private callWorker(pw: PoolWorker, method: string, args: unknown[]): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = pw.nextId++
      pw.pending.set(id, { resolve, reject })
      pw.worker.postMessage({ type: 'CALL', id, method, args })
    })
  }

  terminate(): void {
    this.workers.forEach(pw => pw.worker.terminate())
    this.workers = []
  }
}
