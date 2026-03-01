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
    } else if (method === 'generateChunk') {
      // Generate heightmap AND normals in a single worker call.
      // The heightmap never crosses the thread boundary before normals are computed,
      // which avoids the detached-buffer / empty-Float32Array issue.
      const [configJSON, cx, cz, resolution, chunkSize, heightScale] =
        args as [string, number, number, number, number, number]

      const heightmap = go_generateHeightmap(configJSON, cx, cz)
      if (!heightmap || !heightmap.buffer) throw new Error('go_generateHeightmap returned no data')

      const normals = go_computeNormals(heightmap, resolution, chunkSize, heightScale)
      if (!normals || !normals.buffer) throw new Error('go_computeNormals returned no data')

      // Transfer both arrays to the main thread.
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
