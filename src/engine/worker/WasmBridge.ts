// Typed wrappers around Go WASM globals registered at runtime via syscall/js.

export interface ChunkCoord {
  x: number
  z: number
}

export interface ChunkGenResult {
  coord: ChunkCoord
  heightmap: number[]
  normals: number[]
}

export interface WorldUpdate {
  chunksToAdd: ChunkGenResult[]
  chunksToRemove: ChunkCoord[]
}

declare global {
  function go_ping(): string
  function go_initWorld(configJSON: string): void
  function go_worldUpdate(playerX: number, playerZ: number): string
  function go_updatePlayer(inputJSON: string, dt: number): string
  function go_getChunkHeight(worldX: number, worldZ: number): number
  function go_decodeHeightmapImage(imageBytes: Uint8Array, outputResolution: number): Float32Array
  function go_generateHeightmap(configJSON: string, chunkX: number, chunkZ: number): Float32Array
  function go_computeNormals(
    heightmapBuffer: Float32Array,
    resolution: number,
    chunkSize: number,
    heightScale: number,
  ): Float32Array
  /** Combined heightmap+normals generation in pure Go — returns flat [hm..., normals...] */
  function go_generateChunk(
    configJSON: string,
    chunkX: number,
    chunkZ: number,
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

  static worldUpdate(playerX: number, playerZ: number): WorldUpdate {
    return JSON.parse(go_worldUpdate(playerX, playerZ)) as WorldUpdate
  }

  static updatePlayer(input: object, dt: number): object {
    return JSON.parse(go_updatePlayer(JSON.stringify(input), dt))
  }

  static getChunkHeight(worldX: number, worldZ: number): number {
    return go_getChunkHeight(worldX, worldZ)
  }

  static decodeHeightmapImage(imageBytes: Uint8Array, outputResolution: number): Float32Array {
    return go_decodeHeightmapImage(imageBytes, outputResolution)
  }

  static generateHeightmap(config: object, chunkX: number, chunkZ: number): Float32Array {
    return go_generateHeightmap(JSON.stringify(config), chunkX, chunkZ)
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
