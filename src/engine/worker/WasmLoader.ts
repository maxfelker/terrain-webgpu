// Thin module wrapping the Go WASM runtime loading process.
// Keeps terrain.worker.ts clean by extracting all WASM instantiation logic here.

export interface WasmLoaderOptions {
  wasmExecUrl: string
  wasmBinaryUrl: string
}

declare function importScripts(...urls: string[]): void

declare class Go {
  importObject: WebAssembly.Imports
  run(instance: WebAssembly.Instance): Promise<void>
}

export default async function loadWasm(options: WasmLoaderOptions): Promise<void> {
  const { wasmExecUrl, wasmBinaryUrl } = options

  // Classic workers (IIFE format, no type:'module') support importScripts.
  // Vite bundles this worker as IIFE so importScripts is available at runtime.
  importScripts(wasmExecUrl)

  const go = new Go()

  const result = await WebAssembly.instantiateStreaming(
    fetch(wasmBinaryUrl),
    go.importObject,
  )

  go.run(result.instance)
}
