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
}

self.onmessage = handleMessage
