// Web Worker: loads the Go WASM terrain engine and dispatches game logic messages.
// All WASM instantiation is delegated to WasmLoader.

import loadWasm from './WasmLoader'

let wasmReady = false

function handleInit(): void {
  loadWasm({ wasmExecUrl: '/wasm_exec.js', wasmBinaryUrl: '/terrain.wasm' })
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
    } else if (method === 'generateHeightmap') {
      const arr = go_generateHeightmap(args[0] as string, args[1] as number, args[2] as number)
      if (!arr || !arr.buffer) throw new Error('go_generateHeightmap returned no data — WASM may have panicked')
      result = arr
      transfer = [arr.buffer as ArrayBuffer]
    } else if (method === 'computeNormals') {
      // heightmap arrives via structured clone in args[0] — avoids detached-buffer issues
      const heightmap = args[0] as Float32Array
      const [resolution, chunkSize, heightScale] = [args[1], args[2], args[3]] as [number, number, number]
      const arr = go_computeNormals(heightmap, resolution, chunkSize, heightScale)
      if (!arr || !arr.buffer) throw new Error('go_computeNormals returned no data — WASM may have panicked')
      result = arr
      transfer = [arr.buffer as ArrayBuffer]
    } else {
      throw new Error(`Unknown method: ${method}`)
    }

    self.postMessage({ type: 'RESULT', id, result }, { transfer })
  } catch (err) {
    self.postMessage({ type: 'RESULT', id, error: String(err) })
  }
}

function handleMessage(event: MessageEvent): void {
  const { type } = event.data

  if (type === 'INIT') {
    handleInit()
    return
  }

  if (!wasmReady) {
    self.postMessage({ type: 'ERROR', message: 'WASM not ready' })
    return
  }

  if (type === 'PING') handlePing()
  if (type === 'WORLD_UPDATE') handleWorldUpdate(event.data)
  if (type === 'CALL') handleCall(event)
}

self.onmessage = handleMessage
