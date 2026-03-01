package biome

import (
	"github.com/maxfelker/terrain-webgpu/wasm/noise"
	"github.com/maxfelker/terrain-webgpu/wasm/terrain"
)

// GenerateHeightmapPerVertex generates a heightmap where every vertex independently
// samples its own biome based on world position, then applies that biome's noise
// parameters and height multiplier.
//
// This guarantees seamless chunk boundaries: both sides of a shared edge compute
// the vertex at the exact same world coordinate → same biome → same height.
func GenerateHeightmapPerVertex(chunkX, chunkZ int, cfg terrain.ChunkConfig, worldSeed int) (hm []float32, dominant BiomeType) {
	res := cfg.HeightmapResolution
	out := make([]float32, res*res)
	worldOriginX := float64(chunkX * cfg.Dimension)
	worldOriginZ := float64(chunkZ * cfg.Dimension)
	spacing := float64(cfg.Dimension) / float64(res-1)

	biomeCounts := make(map[BiomeType]int, 6)

	for row := range res {
		for col := range res {
			wx := worldOriginX + float64(col)*spacing
			wz := worldOriginZ + float64(row)*spacing

			bt := GetBiomeAt(wx, wz, worldSeed)
			def := DefaultBiomes[bt]
			biomeCounts[bt]++

			sx, sz := noise.SkewXZ(wx, wz)
			raw := noise.FBm(sx, sz, cfg.Seed, def.Octaves, def.Frequency, def.Lacunarity, def.Persistence)
			raw *= def.Amplitude

			normalized := (raw + 1.0) * 0.5
			out[row*res+col] = float32(noise.Clamp(normalized, 0, 1) * def.HeightMultiplier)
		}
	}

	// Determine dominant biome by vertex count.
	dominant = Grassland
	maxCount := 0
	for bt, count := range biomeCounts {
		if count > maxCount {
			maxCount = count
			dominant = bt
		}
	}
	return out, dominant
}

// GenerateExtendedHeightmapPerVertex generates a (resolution+2)×(resolution+2)
// extended heightmap with per-vertex biome sampling. Used for cross-boundary
// normal computation without seams.
func GenerateExtendedHeightmapPerVertex(chunkX, chunkZ int, cfg terrain.ChunkConfig, worldSeed int) []float32 {
	res := cfg.HeightmapResolution
	extRes := res + 2
	out := make([]float32, extRes*extRes)
	worldOriginX := float64(chunkX * cfg.Dimension)
	worldOriginZ := float64(chunkZ * cfg.Dimension)
	spacing := float64(cfg.Dimension) / float64(res-1)

	for row := range extRes {
		for col := range extRes {
			// col-1 / row-1: include 1-cell border beyond chunk boundary.
			wx := worldOriginX + float64(col-1)*spacing
			wz := worldOriginZ + float64(row-1)*spacing

			bt := GetBiomeAt(wx, wz, worldSeed)
			def := DefaultBiomes[bt]

			sx, sz := noise.SkewXZ(wx, wz)
			raw := noise.FBm(sx, sz, cfg.Seed, def.Octaves, def.Frequency, def.Lacunarity, def.Persistence)
			raw *= def.Amplitude

			normalized := (raw + 1.0) * 0.5
			out[row*extRes+col] = float32(noise.Clamp(normalized, 0, 1) * def.HeightMultiplier)
		}
	}
	return out
}
