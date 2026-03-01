package terrain_test

import (
	"math"
	"testing"

	"github.com/maxfelker/terrain-webgpu/wasm/terrain"
)

func TestGenerateHeightmap_Size(t *testing.T) {
	cfg := terrain.DefaultConfig()
	cfg.HeightmapResolution = 17
	hm := terrain.GenerateHeightmap(0, 0, cfg)
	want := 17 * 17
	if len(hm) != want {
		t.Errorf("expected %d samples, got %d", want, len(hm))
	}
}

func TestGenerateHeightmap_Range(t *testing.T) {
	cfg := terrain.DefaultConfig()
	cfg.HeightmapResolution = 17
	hm := terrain.GenerateHeightmap(0, 0, cfg)
	for i, v := range hm {
		if v < 0 || v > 1 {
			t.Errorf("heightmap[%d] = %v, want in [0, 1]", i, v)
		}
	}
}

func TestGenerateHeightmap_Determinism(t *testing.T) {
	cfg := terrain.DefaultConfig()
	cfg.HeightmapResolution = 17
	a := terrain.GenerateHeightmap(0, 0, cfg)
	b := terrain.GenerateHeightmap(0, 0, cfg)
	for i := range a {
		if a[i] != b[i] {
			t.Errorf("heightmap not deterministic at index %d", i)
		}
	}
}

func TestGenerateHeightmap_SeamContinuity(t *testing.T) {
	cfg := terrain.DefaultConfig()
	cfg.HeightmapResolution = 17
	chunk00 := terrain.GenerateHeightmap(0, 0, cfg)
	chunk10 := terrain.GenerateHeightmap(1, 0, cfg)
	res := cfg.HeightmapResolution
	for row := range res {
		rightEdge := chunk00[row*res+(res-1)]
		leftEdge := chunk10[row*res+0]
		if math.Abs(float64(rightEdge-leftEdge)) > 0.001 {
			t.Errorf("seam discontinuity at row %d: right=%v left=%v", row, rightEdge, leftEdge)
		}
	}
}

func TestGetHeight_Corners(t *testing.T) {
	cfg := terrain.DefaultConfig()
	cfg.HeightmapResolution = 5
	hm := terrain.GenerateHeightmap(0, 0, cfg)
	h := terrain.GetHeight(0, 0, hm, 5, 100)
	if math.IsNaN(h) {
		t.Error("GetHeight returned NaN")
	}
}

func TestComputeNormals_Size(t *testing.T) {
	cfg := terrain.DefaultConfig()
	cfg.HeightmapResolution = 9
	hm := terrain.GenerateHeightmap(0, 0, cfg)
	normals := terrain.ComputeNormals(hm, 9, float64(cfg.Dimension), float64(cfg.Height))
	want := 9 * 9 * 3
	if len(normals) != want {
		t.Errorf("expected %d normal components, got %d", want, len(normals))
	}
}

func TestComputeNormals_Normalized(t *testing.T) {
	cfg := terrain.DefaultConfig()
	cfg.HeightmapResolution = 9
	hm := terrain.GenerateHeightmap(0, 0, cfg)
	normals := terrain.ComputeNormals(hm, 9, float64(cfg.Dimension), float64(cfg.Height))
	for i := 0; i < len(normals); i += 3 {
		nx, ny, nz := float64(normals[i]), float64(normals[i+1]), float64(normals[i+2])
		length := math.Sqrt(nx*nx + ny*ny + nz*nz)
		if math.Abs(length-1.0) > 0.001 {
			t.Errorf("normal at vertex %d not normalized: length=%v", i/3, length)
		}
	}
}
