package biome

// WorldConfig defines global parameters for biome layout during world generation.
// It can be serialized to/from JSON and loaded before chunk generation begins.
type WorldConfig struct {
	Seed       int     `json:"seed"`       // Controls biome placement noise
	BiomeScale float64 `json:"biomeScale"` // Region size multiplier (default 1.0)
}

// DefaultWorldConfig returns a WorldConfig with standard defaults.
func DefaultWorldConfig() WorldConfig {
	return WorldConfig{
		Seed:       42,
		BiomeScale: 1.0,
	}
}
