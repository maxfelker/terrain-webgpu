package noise_test

import (
	"math"
	"testing"

	"github.com/maxfelker/terrain-webgpu/wasm/noise"
)

func TestSimplex2D_Range(t *testing.T) {
	for x := -5.0; x <= 5.0; x += 0.5 {
		for z := -5.0; z <= 5.0; z += 0.5 {
			v := noise.Simplex2D(x, z, 42)
			if v < -1.1 || v > 1.1 {
				t.Errorf("Simplex2D(%v,%v) = %v, want in [-1.1, 1.1]", x, z, v)
			}
		}
	}
}

func TestSimplex2D_Determinism(t *testing.T) {
	a := noise.Simplex2D(1.5, 2.3, 99)
	b := noise.Simplex2D(1.5, 2.3, 99)
	if a != b {
		t.Errorf("Simplex2D is not deterministic: %v != %v", a, b)
	}
}

func TestSimplex2D_SeedDiffers(t *testing.T) {
	a := noise.Simplex2D(1.0, 1.0, 1)
	b := noise.Simplex2D(1.0, 1.0, 2)
	if a == b {
		t.Error("Different seeds produced same value — seed has no effect")
	}
}

func TestFBm_Range(t *testing.T) {
	v := noise.FBm(1.0, 1.0, 42, 6, 0.001, 2.0, 0.5)
	if math.IsNaN(v) || math.IsInf(v, 0) {
		t.Errorf("FBm returned invalid value: %v", v)
	}
}

func TestSkewXZ_Roundtrip(t *testing.T) {
	x, z := 3.0, 4.0
	sx, sz := noise.SkewXZ(x, z)
	if sx == x && sz == z {
		t.Error("SkewXZ had no effect")
	}
}
