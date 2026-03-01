// Web Worker: loads the Go WASM terrain engine and dispatches game logic messages.
// All WASM instantiation is delegated to WasmLoader.

import loadWasm from './WasmLoader'

let wasmReady = false

function handleInit(wasmBinaryUrl: string, wasmExecUrl: string): void {
  loadWasm({ wasmExecUrl, wasmBinaryUrl })
    .then(() => {
      wasmReady = true
      console.log('[Worker] WASM Ready')
      self.postMessage({ type: 'READY' })
    })
    .catch(err => {
      console.error('[Worker] WASM init failed:', err)
      self.postMessage({ type: 'ERROR', message: String(err) })
    })
}

function handlePing(): void {
  const result = go_ping() as string
  self.postMessage({ type: 'PONG', result })
}

function handleWorldUpdate(data: { playerX: number; playerZ: number }): void {
  const json = go_worldUpdate(data.playerX, data.playerZ) as string
  self.postMessage({ type: 'WORLD_UPDATE', update: JSON.parse(json) })
}

function handleCall(event: MessageEvent): void {
  const { id, method, args } = event.data
  try {
    let result: unknown
    let transfer: Transferable[] = []

    if (method === 'initWorld') {
      go_initWorld(args[0] as string)
      result = null
    } else if (method === 'generateChunk') {
      const [configJSON, cx, cz, resolution, chunkSize, heightScale] =
        args as [string, number, number, number, number, number]

      // go_generateChunk runs both heightmap generation and normal computation
      // entirely inside Go using pure Go slices — no JS Float32Array is ever
      // passed between two Go WASM functions (which silently produces length 0).
      // Returns flat Float32Array: [heightmap(res×res)..., normals(res×res×3)...]
      const combined = go_generateChunk(configJSON, cx, cz, resolution, chunkSize, heightScale)
      if (!combined || !combined.buffer) throw new Error('go_generateChunk returned no data')

      const hmLen = resolution * resolution
      const heightmap = combined.slice(0, hmLen)   // copy, own buffer
      const normals   = combined.slice(hmLen)       // copy, own buffer

      result = { heightmap, normals }
      transfer = [heightmap.buffer as ArrayBuffer, normals.buffer as ArrayBuffer]
    } else {
      throw new Error(`Unknown method: ${method}`)
    }

    self.postMessage({ type: 'RESULT', id, result }, { transfer })
  } catch (err) {
    self.postMessage({ type: 'RESULT', id, error: String(err) })
  }
}

function handleTick(data: { inputJSON: string; dt: number }): void {
  const playerStateJSON = go_updatePlayer(data.inputJSON, data.dt) as string
  self.postMessage({ type: 'TICK_RESULT', playerState: JSON.parse(playerStateJSON) })
}

function handleMessage(event: MessageEvent): void {
  const { type } = event.data

  if (type === 'INIT') {
    handleInit(event.data.wasmBinaryUrl ?? '/terrain.wasm', event.data.wasmExecUrl ?? '/wasm_exec.js')
    return
  }

  if (!wasmReady) {
    self.postMessage({ type: 'ERROR', message: 'WASM not ready' })
    return
  }

  if (type === 'PING') handlePing()
  if (type === 'WORLD_UPDATE') handleWorldUpdate(event.data)
  if (type === 'CALL') handleCall(event)
  if (type === 'TICK') handleTick(event.data)
}

self.onmessage = handleMessage
