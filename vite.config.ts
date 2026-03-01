import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Compute content hash of terrain.wasm so the URL changes whenever the binary changes.
// This busts the browser cache even for users who previously received immutable headers.
const wasmPath = resolve(__dirname, 'public/terrain.wasm')
let wasmHash = 'dev'
try {
  wasmHash = createHash('sha256').update(readFileSync(wasmPath)).digest('hex').slice(0, 8)
} catch {
  // WASM not yet built (fresh clone) — dev mode will still work with a static name
}

export default defineConfig({
  plugins: [react()],
  define: {
    __WASM_HASH__: JSON.stringify(wasmHash),
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['terrain-wasm'],
  },
  assetsInclude: ['**/*.wasm', '**/*.wgsl'],
})
