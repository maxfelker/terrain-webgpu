package biome

// DefaultBiomes contains the standard biome definitions used during world generation.
var DefaultBiomes = map[BiomeType]BiomeDefinition{
	Grassland: {
		Name:             "Grassland",
		Type:             Grassland,
		Octaves:          5,
		Frequency:        0.0008,
		Lacunarity:       2.0,
		Persistence:      0.50,
		Amplitude:        1.0,
		HeightMultiplier: 1.0,
	},
	Desert: {
		Name:             "Desert",
		Type:             Desert,
		Octaves:          3,
		Frequency:        0.0004,
		Lacunarity:       2.0,
		Persistence:      0.40,
		Amplitude:        1.0,
		HeightMultiplier: 0.8,
	},
	Mountains: {
		Name:             "Mountains",
		Type:             Mountains,
		Octaves:          7,
		Frequency:        0.002,
		Lacunarity:       2.2,
		Persistence:      0.60,
		Amplitude:        1.0,
		HeightMultiplier: 10.0,
	},
	Valley: {
		Name:             "Valley",
		Type:             Valley,
		Octaves:          4,
		Frequency:        0.0006,
		Lacunarity:       2.0,
		Persistence:      0.45,
		Amplitude:        1.0,
		HeightMultiplier: 0.6,
	},
	Swamp: {
		Name:             "Swamp",
		Type:             Swamp,
		Octaves:          2,
		Frequency:        0.001,
		Lacunarity:       2.0,
		Persistence:      0.35,
		Amplitude:        1.0,
		HeightMultiplier: 0.25,
	},
	Forest: {
		Name:             "Forest",
		Type:             Forest,
		Octaves:          5,
		Frequency:        0.001,
		Lacunarity:       2.0,
		Persistence:      0.55,
		Amplitude:        1.0,
		HeightMultiplier: 1.2,
	},
}

// ScaleHeightmap multiplies all heightmap values by the given multiplier in-place.
// The resulting values may exceed [0,1] for biomes with HeightMultiplier > 1.
func ScaleHeightmap(hm []float32, multiplier float64) {
	for i, v := range hm {
		hm[i] = float32(float64(v) * multiplier)
	}
}
