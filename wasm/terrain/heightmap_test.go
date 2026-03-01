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

func TestGenerateExtendedHeightmap_Size(t *testing.T) {
	cfg := terrain.DefaultConfig()
	ext := terrain.GenerateExtendedHeightmap(0, 0, cfg)
	extRes := cfg.HeightmapResolution + 2 // 131
	expected := extRes * extRes
	if len(ext) != expected {
		t.Errorf("expected extended heightmap size %d, got %d", expected, len(ext))
	}
}

func TestGenerateExtendedHeightmap_InnerMatchesRegular(t *testing.T) {
	cfg := terrain.DefaultConfig()
	regular := terrain.GenerateHeightmap(0, 0, cfg)
	ext := terrain.GenerateExtendedHeightmap(0, 0, cfg)

	res := cfg.HeightmapResolution  // 129
	extRes := res + 2               // 131

	// Inner region of extended (rows 1..res, cols 1..res) should match regular
	for row := range res {
		for col := range res {
			regularVal := regular[row*res+col]
			extVal := ext[(row+1)*extRes+(col+1)]
			diff := extVal - regularVal
			if diff < 0 {
				diff = -diff
			}
			if diff > 1e-6 {
				t.Errorf("mismatch at (%d,%d): regular=%.6f ext=%.6f", row, col, regularVal, extVal)
			}
		}
	}
}

func TestGenerateExtendedHeightmap_BorderMatchesNeighbor(t *testing.T) {
	cfg := terrain.DefaultConfig()

	// Left border of chunk (1,0) extended hm should match right column of chunk (0,0) regular hm
	regularLeft := terrain.GenerateHeightmap(0, 0, cfg)
	extRight := terrain.GenerateExtendedHeightmap(1, 0, cfg)

	res := cfg.HeightmapResolution // 129
	extRes := res + 2              // 131

	for row := range res {
		// Second-to-last col of regular chunk(0,0): col = res-2 (one spacing left of the shared boundary)
		regularVal := regularLeft[row*res+(res-2)]
		// Left border of extended chunk(1,0): col=0 in extended, sampled one spacing unit left of chunk(1,0) origin
		extBorderVal := extRight[(row+1)*extRes+0]
		diff := extBorderVal - regularVal
		if diff < 0 {
			diff = -diff
		}
		if diff > 1e-6 {
			t.Errorf("border mismatch at row %d: regularLeft secondToLastCol=%.6f extRight leftBorder=%.6f", row, regularVal, extBorderVal)
		}
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
