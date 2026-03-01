// Web Worker: loads the Go WASM terrain engine and handles messages from the main thread

declare function importScripts(...urls: string[]): void

let wasmReady = false

async function initWasm(): Promise<void> {
  importScripts('/wasm_exec.js')

  // @ts-expect-error — Go is injected into global scope by wasm_exec.js
  const go = new Go()
  const result = await WebAssembly.instantiateStreaming(fetch('/terrain.wasm'), go.importObject)
  go.run(result.instance)
  wasmReady = true
  console.log('[Worker] WASM Ready')
  self.postMessage({ type: 'READY' })
}

function handleMessage(event: MessageEvent): void {
  const { type } = event.data

  if (type === 'INIT') {
    initWasm().catch(err => {
      console.error('[Worker] WASM init failed:', err)
      self.postMessage({ type: 'ERROR', message: String(err) })
    })
    return
  }

  if (!wasmReady) {
    self.postMessage({ type: 'ERROR', message: 'WASM not ready' })
    return
  }

  if (type === 'PING') {
    const result = go_ping() as string
    self.postMessage({ type: 'PONG', result })
  }
}

self.onmessage = handleMessage
