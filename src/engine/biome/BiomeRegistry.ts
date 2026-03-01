import { BiomeType, BIOME_NAMES } from './BiomeTypes'

export interface BiomeClientDefinition {
  name: string
  type: BiomeType
}

// BiomeRegistry provides client-side biome metadata.
// Terrain noise params live in Go; this holds display/rendering info.
export const BiomeRegistry: Record<number, BiomeClientDefinition> = {
  [BiomeType.Grassland]: { name: BIOME_NAMES[BiomeType.Grassland], type: BiomeType.Grassland },
  [BiomeType.Desert]:    { name: BIOME_NAMES[BiomeType.Desert],    type: BiomeType.Desert },
  [BiomeType.Mountains]: { name: BIOME_NAMES[BiomeType.Mountains], type: BiomeType.Mountains },
  [BiomeType.Valley]:    { name: BIOME_NAMES[BiomeType.Valley],    type: BiomeType.Valley },
  [BiomeType.Swamp]:     { name: BIOME_NAMES[BiomeType.Swamp],     type: BiomeType.Swamp },
  [BiomeType.Forest]:    { name: BIOME_NAMES[BiomeType.Forest],    type: BiomeType.Forest },
}

export function getBiomeName(biomeId: number): string {
  return BiomeRegistry[biomeId]?.name ?? 'Unknown'
}
