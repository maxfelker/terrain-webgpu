// Package biome defines terrain biome types and their generation parameters.
package biome

// BiomeType identifies a biome variant.
type BiomeType int

const (
	Grassland  BiomeType = 0
	Desert     BiomeType = 1
	Mountains  BiomeType = 2
	Valley     BiomeType = 3
	Swamp      BiomeType = 4
	Forest     BiomeType = 5
)

// BiomeDefinition holds all parameters that control terrain generation for a biome.
type BiomeDefinition struct {
	Name    string
	Type    BiomeType
	// Noise parameters
	Octaves     int
	Frequency   float64
	Lacunarity  float64
	Persistence float64
	Amplitude   float64
	// HeightMultiplier scales the normalized [0,1] heightmap values.
	// Values > 1.0 create taller terrain; < 1.0 creates flatter terrain.
	HeightMultiplier float64
}
