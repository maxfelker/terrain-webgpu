// BiomeType mirrors the Go biome.BiomeType enum values.
export const BiomeType = {
  Grassland: 0,
  Desert:    1,
  Mountains: 2,
  Valley:    3,
  Swamp:     4,
  Forest:    5,
} as const

export type BiomeType = typeof BiomeType[keyof typeof BiomeType]

export const BIOME_NAMES: Record<number, string> = {
  [BiomeType.Grassland]: 'Grassland',
  [BiomeType.Desert]: 'Desert',
  [BiomeType.Mountains]: 'Mountains',
  [BiomeType.Valley]: 'Valley',
  [BiomeType.Swamp]: 'Swamp',
  [BiomeType.Forest]: 'Forest',
}

export interface WorldConfig {
  seed: number
  biomeScale: number
}

export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  seed: 42,
  biomeScale: 1.0,
}
