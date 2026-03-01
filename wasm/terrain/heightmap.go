package terrain

import (
	"github.com/maxfelker/terrain-webgpu/wasm/noise"
)

// GenerateHeightmap produces a flat row-major float32 slice of size resolution×resolution.
// Values are normalized to [0, 1].
func GenerateHeightmap(chunkX, chunkZ int, cfg ChunkConfig) []float32 {
	res := cfg.HeightmapResolution
	out := make([]float32, res*res)
	worldOriginX := float64(chunkX * cfg.Dimension)
	worldOriginZ := float64(chunkZ * cfg.Dimension)
	spacing := float64(cfg.Dimension) / float64(res-1)

	for row := range res {
		for col := range res {
			wx := worldOriginX + float64(col)*spacing + cfg.OffsetX
			wz := worldOriginZ + float64(row)*spacing + cfg.OffsetZ

			sx, sz := noise.SkewXZ(wx, wz)

			raw := noise.FBm(sx, sz, cfg.Seed, cfg.Octaves, cfg.Frequency, cfg.Lacunarity, cfg.Persistence)
			raw *= cfg.Amplitude * cfg.Gain

			normalized := (raw + 1.0) * 0.5
			out[row*res+col] = float32(noise.Clamp(normalized, 0, 1))
		}
	}
	return out
}

// GenerateExtendedHeightmap produces a (resolution+2)×(resolution+2) heightmap
// that includes a 1-cell border sampled one spacing unit beyond the chunk boundary.
// This enables ComputeNormalsFromExtended to compute correct cross-boundary normals
// without clamping. Values are normalized to [0, 1] like GenerateHeightmap.
func GenerateExtendedHeightmap(chunkX, chunkZ int, cfg ChunkConfig) []float32 {
	res := cfg.HeightmapResolution
	extRes := res + 2
	out := make([]float32, extRes*extRes)
	worldOriginX := float64(chunkX * cfg.Dimension)
	worldOriginZ := float64(chunkZ * cfg.Dimension)
	spacing := float64(cfg.Dimension) / float64(res-1)

	for row := range extRes {
		for col := range extRes {
			// col-1 and row-1: shift by 1 to include the border cell at index 0
			wx := worldOriginX + float64(col-1)*spacing + cfg.OffsetX
			wz := worldOriginZ + float64(row-1)*spacing + cfg.OffsetZ

			sx, sz := noise.SkewXZ(wx, wz)
			raw := noise.FBm(sx, sz, cfg.Seed, cfg.Octaves, cfg.Frequency, cfg.Lacunarity, cfg.Persistence)
			raw *= cfg.Amplitude * cfg.Gain

			normalized := (raw + 1.0) * 0.5
			out[row*extRes+col] = float32(noise.Clamp(normalized, 0, 1))
		}
	}
	return out
}

// GetHeight returns the world-space height at a local normalized position [0,1] within a chunk.
func GetHeight(localX, localZ float64, heightmap []float32, resolution int, heightScale float64) float64 {
	fx := localX * float64(resolution-1)
	fz := localZ * float64(resolution-1)
	ix := int(fx)
	iz := int(fz)
	if ix >= resolution-1 {
		ix = resolution - 2
	}
	if iz >= resolution-1 {
		iz = resolution - 2
	}
	tx := fx - float64(ix)
	tz := fz - float64(iz)
	h00 := float64(heightmap[iz*resolution+ix])
	h10 := float64(heightmap[iz*resolution+ix+1])
	h01 := float64(heightmap[(iz+1)*resolution+ix])
	h11 := float64(heightmap[(iz+1)*resolution+ix+1])
	h := (h00*(1-tx)+h10*tx)*(1-tz) + (h01*(1-tx)+h11*tx)*tz
	return h * heightScale
}
