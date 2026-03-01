// Typed wrappers around Go WASM globals registered at runtime via syscall/js.
// Stubs here; full implementations land in M2–M7.

declare global {
  function go_ping(): string
  function go_initWorld(configJSON: string): void
  function go_worldUpdate(playerX: number, playerZ: number): string
  function go_updatePlayer(inputJSON: string, dt: number): string
  function go_getChunkHeight(chunkX: number, chunkZ: number, worldX: number, worldZ: number): number
  function go_decodeHeightmapImage(imageBytes: Uint8Array, outputResolution: number): Float32Array
  function go_generateHeightmap(configJSON: string): Float32Array
  function go_computeNormals(
    heightmapBuffer: Float32Array,
    resolution: number,
    chunkSize: number,
    heightScale: number,
  ): Float32Array
}

export default class WasmBridge {
  static ping(): string {
    return go_ping()
  }

  static initWorld(config: object): void {
    go_initWorld(JSON.stringify(config))
  }

  static worldUpdate(playerX: number, playerZ: number): object {
    return JSON.parse(go_worldUpdate(playerX, playerZ))
  }

  static updatePlayer(input: object, dt: number): object {
    return JSON.parse(go_updatePlayer(JSON.stringify(input), dt))
  }

  static getChunkHeight(chunkX: number, chunkZ: number, worldX: number, worldZ: number): number {
    return go_getChunkHeight(chunkX, chunkZ, worldX, worldZ)
  }

  static decodeHeightmapImage(imageBytes: Uint8Array, outputResolution: number): Float32Array {
    return go_decodeHeightmapImage(imageBytes, outputResolution)
  }

  static generateHeightmap(config: object): Float32Array {
    return go_generateHeightmap(JSON.stringify(config))
  }

  static computeNormals(
    heightmapBuffer: Float32Array,
    resolution: number,
    chunkSize: number,
    heightScale: number,
  ): Float32Array {
    return go_computeNormals(heightmapBuffer, resolution, chunkSize, heightScale)
  }
}
