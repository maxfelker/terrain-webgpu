package biome

import (
	"math"

	"github.com/maxfelker/terrain-webgpu/wasm/noise"
	"github.com/maxfelker/terrain-webgpu/wasm/terrain"
)

// biomeClimate defines the "ideal" temperature/humidity center for a biome and
// the Gaussian sigma controlling how wide its influence region is.
// Larger sigma = wider blend zone = more gradual transitions.
type biomeClimate struct {
	temp, humid, sigma float64
}

// climates places each biome at a characteristic position in climate space.
// Biomes with overlapping Gaussian distributions will naturally blend at boundaries.
var climates = [6]biomeClimate{
	Grassland: {0.52, 0.42, 0.22},
	Desert:    {0.82, 0.14, 0.18},
	Mountains: {0.13, 0.45, 0.24},
	Valley:    {0.47, 0.30, 0.18},
	Swamp:     {0.62, 0.86, 0.20},
	Forest:    {0.51, 0.66, 0.20},
}

// gaussianBiomeWeights returns a normalised [6]float64 of per-biome blend weights
// computed from Gaussian distance to each biome's climate center.
// At any temp/humidity point, adjacent biomes receive non-zero weights so heights
// transition continuously rather than jumping at a hard classification boundary.
func gaussianBiomeWeights(temperature, humidity float64) [6]float64 {
	var w [6]float64
	var total float64
	for i, c := range climates {
		dt := temperature - c.temp
		dh := humidity - c.humid
		w[i] = math.Exp(-(dt*dt + dh*dh) / (2 * c.sigma * c.sigma))
		total += w[i]
	}
	if total > 0 {
		for i := range w {
			w[i] /= total
		}
	}
	return w
}

// sampleBiomeHeight computes the raw terrain height at (wx, wz) using the
// noise parameters of a specific biome definition.
func sampleBiomeHeight(wx, wz float64, terrainSeed int, def BiomeDefinition) float64 {
	sx, sz := noise.SkewXZ(wx, wz)
	raw := noise.FBm(sx, sz, terrainSeed, def.Octaves, def.Frequency, def.Lacunarity, def.Persistence)
	raw *= def.Amplitude
	return noise.Clamp((raw+1.0)*0.5, 0, 1) * def.HeightMultiplier
}

// blendedHeight computes the Gaussian-weighted blend of heights from all biomes
// at a single world-space vertex. This is the core routine that eliminates hard
// terrain walls at biome boundaries.
func blendedHeight(wx, wz float64, terrainSeed int, weights [6]float64) float32 {
	var total float64
	for i, w := range weights {
		if w < 0.005 {
			continue // skip negligible contributors
		}
		h := sampleBiomeHeight(wx, wz, terrainSeed, DefaultBiomes[BiomeType(i)])
		total += h * w
	}
	return float32(total)
}

// dominantBiomeFromWeights returns the BiomeType with the highest weight.
func dominantBiomeFromWeights(weights [6]float64) BiomeType {
	best := 0
	for i := 1; i < 6; i++ {
		if weights[i] > weights[best] {
			best = i
		}
	}
	return BiomeType(best)
}

// GenerateHeightmapPerVertex generates a heightmap where every vertex uses
// Gaussian-weighted biome blending based on its world-space temperature/humidity.
// This ensures:
//   - Seamless chunk boundaries (same world coord → same result on both sides)
//   - Smooth terrain transitions (no hard walls at biome boundaries)
func GenerateHeightmapPerVertex(chunkX, chunkZ int, cfg terrain.ChunkConfig, worldSeed int) (hm []float32, dominant BiomeType) {
	res := cfg.HeightmapResolution
	out := make([]float32, res*res)
	worldOriginX := float64(chunkX * cfg.Dimension)
	worldOriginZ := float64(chunkZ * cfg.Dimension)
	spacing := float64(cfg.Dimension) / float64(res-1)

	weightSums := [6]float64{}

	for row := range res {
		for col := range res {
			wx := worldOriginX + float64(col)*spacing
			wz := worldOriginZ + float64(row)*spacing

			temperature, humidity := GetBiomeParams(wx, wz, worldSeed)
			weights := gaussianBiomeWeights(temperature, humidity)

			out[row*res+col] = blendedHeight(wx, wz, cfg.Seed, weights)

			for i, w := range weights {
				weightSums[i] += w
			}
		}
	}

	// Dominant biome is whichever accumulated the most weight across all vertices.
	dominant = dominantBiomeFromWeights(weightSums)
	return out, dominant
}

// GenerateExtendedHeightmapPerVertex generates a (resolution+2)×(resolution+2)
// extended heightmap with Gaussian-blended per-vertex heights for seamless
// cross-boundary normal computation.
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

			temperature, humidity := GetBiomeParams(wx, wz, worldSeed)
			weights := gaussianBiomeWeights(temperature, humidity)

			out[row*extRes+col] = blendedHeight(wx, wz, cfg.Seed, weights)
		}
	}
	return out
}

