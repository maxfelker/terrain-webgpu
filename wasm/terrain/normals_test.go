package terrain_test

import (
	"math"
	"testing"

	"github.com/maxfelker/terrain-webgpu/wasm/terrain"
)

func TestComputeNormalsFromExtended_Size(t *testing.T) {
	cfg := terrain.DefaultConfig()
	hm := terrain.GenerateHeightmap(0, 0, cfg)
	ext := terrain.GenerateExtendedHeightmap(0, 0, cfg)
	normals := terrain.ComputeNormalsFromExtended(ext, cfg.HeightmapResolution, float64(cfg.Dimension), float64(cfg.Height))
	expected := cfg.HeightmapResolution * cfg.HeightmapResolution * 3
	if len(normals) != expected {
		t.Errorf("expected normals size %d, got %d", expected, len(normals))
	}
	_ = hm
}

func TestComputeNormalsFromExtended_CrossChunkConsistency(t *testing.T) {
	cfg := terrain.DefaultConfig()
	res := cfg.HeightmapResolution // 129
	dim := float64(cfg.Dimension)
	h := float64(cfg.Height)

	// Compute extended normals for chunk (0,0) — right edge (col=res-1)
	ext00 := terrain.GenerateExtendedHeightmap(0, 0, cfg)
	normals00 := terrain.ComputeNormalsFromExtended(ext00, res, dim, h)

	// Compute extended normals for chunk (1,0) — left edge (col=0)
	ext10 := terrain.GenerateExtendedHeightmap(1, 0, cfg)
	normals10 := terrain.ComputeNormalsFromExtended(ext10, res, dim, h)

	// Right edge of chunk(0,0) normals should match left edge of chunk(1,0) normals
	// (they sample the same heights via the extended border)
	const tolerance = 1e-4
	for row := range res {
		rightEdgeIdx := (row*res + (res - 1)) * 3
		leftEdgeIdx := (row * res) * 3

		for c := range 3 {
			n00 := normals00[rightEdgeIdx+c]
			n10 := normals10[leftEdgeIdx+c]
			diff := n00 - n10
			if diff < 0 {
				diff = -diff
			}
			if diff > float32(tolerance) {
				t.Errorf("normal mismatch at row=%d component=%d: chunk(0,0) right=%.5f chunk(1,0) left=%.5f",
					row, c, n00, n10)
			}
		}
	}
}

func TestComputeNormalsFromExtended_NormalizedUnit(t *testing.T) {
	cfg := terrain.DefaultConfig()
	ext := terrain.GenerateExtendedHeightmap(2, 3, cfg)
	normals := terrain.ComputeNormalsFromExtended(ext, cfg.HeightmapResolution, float64(cfg.Dimension), float64(cfg.Height))

	res := cfg.HeightmapResolution
	for i := range res * res {
		nx := normals[i*3]
		ny := normals[i*3+1]
		nz := normals[i*3+2]
		length := float32(math.Sqrt(float64(nx*nx + ny*ny + nz*nz)))
		if length < 0.999 || length > 1.001 {
			t.Errorf("normal at %d is not unit length: %.5f", i, length)
			break
		}
	}
}
