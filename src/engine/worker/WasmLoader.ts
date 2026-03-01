// Thin module wrapping the Go WASM runtime loading process.
// Keeps terrain.worker.ts clean by extracting all WASM instantiation logic here.

export interface WasmLoaderOptions {
  wasmExecUrl: string
  wasmBinaryUrl: string
}

declare class Go {
  importObject: WebAssembly.Imports
  run(instance: WebAssembly.Instance): Promise<void>
}

export default async function loadWasm(options: WasmLoaderOptions): Promise<void> {
  const { wasmExecUrl, wasmBinaryUrl } = options

  // Module workers don't support importScripts(). Fetch the script text and
  // execute it via indirect eval so it runs in global scope, which is required
  // for wasm_exec.js to define the Go class on globalThis.
  const scriptText = await fetch(wasmExecUrl).then(r => r.text())
  // eslint-disable-next-line no-eval
  ;(0, eval)(scriptText)

  const go = new Go()

  const result = await WebAssembly.instantiateStreaming(
    fetch(wasmBinaryUrl),
    go.importObject,
  )

  go.run(result.instance)
}
