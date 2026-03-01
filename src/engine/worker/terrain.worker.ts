// Web Worker: loads Go WASM engine, handles messages from main thread

declare function importScripts(...urls: string[]): void

let wasmReady = false

async function initWasm() {
  try {
    // Load Go's wasm_exec.js runtime shim
    importScripts('/wasm_exec.js')

    // @ts-ignore - Go is injected by wasm_exec.js
    const go = new Go()
    const result = await WebAssembly.instantiateStreaming(
      fetch('/terrain.wasm'),
      go.importObject
    )
    go.run(result.instance)
    wasmReady = true
    console.log('[Worker] WASM Ready')
    self.postMessage({ type: 'READY' })
  } catch (err) {
    console.error('[Worker] WASM init failed:', err)
    self.postMessage({ type: 'ERROR', message: String(err) })
  }
}

self.onmessage = async (event: MessageEvent) => {
  const { type } = event.data

  if (type === 'INIT') {
    await initWasm()
    return
  }

  if (!wasmReady) {
    self.postMessage({ type: 'ERROR', message: 'WASM not ready' })
    return
  }

  if (type === 'PING') {
    // @ts-ignore
    const result = go_ping()
    self.postMessage({ type: 'PONG', result })
    return
  }
}
