package terrain

// ChunkConfig mirrors terra-major TerrainChunkConfig.
type ChunkConfig struct {
	ID                  string
	Seed                int
	Dimension           int
	Height              int
	HeightmapResolution int
	AlphamapResolution  int
	Octaves             int
	Frequency           float64
	Lacunarity          float64
	Persistence         float64
	Amplitude           float64
	Gain                float64
	OffsetX             float64
	OffsetZ             float64
	MinHeight           float64
	MaxHeight           float64
}

// DefaultConfig returns sensible defaults.
func DefaultConfig() ChunkConfig {
	return ChunkConfig{
		Seed:                42,
		Dimension:           512,
		Height:              100,
		HeightmapResolution: 129,
		AlphamapResolution:  129,
		Octaves:             6,
		Frequency:           0.001,
		Lacunarity:          2.0,
		Persistence:         0.5,
		Amplitude:           1.0,
		Gain:                1.0,
	}
}
