/// <reference types="vite/client" />
/// <reference types="@webgpu/types" />

declare module '*.wgsl?raw' {
  const content: string
  export default content
}

// Injected by vite.config.ts — content hash of public/terrain.wasm at build time
declare const __WASM_HASH__: string
