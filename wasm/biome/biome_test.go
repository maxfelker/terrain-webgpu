package biome_test

import (
	"testing"

	"github.com/maxfelker/terrain-webgpu/wasm/biome"
	"github.com/maxfelker/terrain-webgpu/wasm/terrain"
)

func TestGetBiomeAt_Deterministic(t *testing.T) {
	a := biome.GetBiomeAt(1000, 2000, 42)
	b := biome.GetBiomeAt(1000, 2000, 42)
	if a != b {
		t.Error("GetBiomeAt is not deterministic")
	}
}

func TestGetBiomeAt_SeedDiffers(t *testing.T) {
	// Different seeds should produce different biome maps across a region.
	same := 0
	total := 0
	for x := 0.0; x < 50000; x += 5000 {
		for z := 0.0; z < 50000; z += 5000 {
			a := biome.GetBiomeAt(x, z, 42)
			b := biome.GetBiomeAt(x, z, 9999)
			total++
			if a == b {
				same++
			}
		}
	}
	// Expect at least some differences across the region
	if same == total {
		t.Error("Different seeds produced identical biome maps — seed has no effect")
	}
}

func TestClassifyBiome_Desert(t *testing.T) {
	// hot (0.80) + dry (0.10) → Desert
	got := biome.ClassifyBiome(0.80, 0.10)
	if got != biome.Desert {
		t.Errorf("Expected Desert, got BiomeType %d", got)
	}
}

func TestClassifyBiome_Mountains(t *testing.T) {
	// cold (0.15) → Mountains
	got := biome.ClassifyBiome(0.15, 0.50)
	if got != biome.Mountains {
		t.Errorf("Expected Mountains, got BiomeType %d", got)
	}
}

func TestClassifyBiome_Swamp(t *testing.T) {
	// warm (0.55) + very wet (0.85) → Swamp
	got := biome.ClassifyBiome(0.55, 0.85)
	if got != biome.Swamp {
		t.Errorf("Expected Swamp, got BiomeType %d", got)
	}
}

func TestClassifyBiome_Forest(t *testing.T) {
	// temperate (0.50) + wet (0.65) → Forest
	got := biome.ClassifyBiome(0.50, 0.65)
	if got != biome.Forest {
		t.Errorf("Expected Forest, got BiomeType %d", got)
	}
}

func TestClassifyBiome_Valley(t *testing.T) {
	// moderate temp + dry → Valley
	got := biome.ClassifyBiome(0.50, 0.30)
	if got != biome.Valley {
		t.Errorf("Expected Valley, got BiomeType %d", got)
	}
}

func TestClassifyBiome_NoDesertAtHighHumidity(t *testing.T) {
	// Desert should never appear at high humidity
	for humid := 0.30; humid <= 1.0; humid += 0.05 {
		got := biome.ClassifyBiome(0.80, humid)
		if got == biome.Desert {
			t.Errorf("Desert classified at high humidity %.2f — violates Whittaker adjacency", humid)
		}
	}
}

func TestClassifyBiome_NoSwampAtLowHumidity(t *testing.T) {
	// Swamp should never appear at low humidity
	for humid := 0.0; humid < 0.70; humid += 0.05 {
		for temp := 0.3; temp <= 0.8; temp += 0.1 {
			got := biome.ClassifyBiome(temp, humid)
			if got == biome.Swamp {
				t.Errorf("Swamp classified at low humidity %.2f (temp=%.2f)", humid, temp)
			}
		}
	}
}

func TestDefaultBiomes_AllDefined(t *testing.T) {
	types := []biome.BiomeType{
		biome.Grassland, biome.Desert, biome.Mountains,
		biome.Valley, biome.Swamp, biome.Forest,
	}
	for _, bt := range types {
		def, ok := biome.DefaultBiomes[bt]
		if !ok {
			t.Errorf("BiomeType %d not in DefaultBiomes", bt)
			continue
		}
		if def.Name == "" {
			t.Errorf("BiomeType %d has empty Name", bt)
		}
		if def.Octaves <= 0 {
			t.Errorf("BiomeType %d (%s) has invalid Octaves: %d", bt, def.Name, def.Octaves)
		}
		if def.HeightMultiplier <= 0 {
			t.Errorf("BiomeType %d (%s) has invalid HeightMultiplier: %f", bt, def.Name, def.HeightMultiplier)
		}
		if def.Frequency <= 0 {
			t.Errorf("BiomeType %d (%s) has invalid Frequency: %f", bt, def.Name, def.Frequency)
		}
	}
}

func TestScaleHeightmap(t *testing.T) {
	hm := []float32{0.0, 0.25, 0.5, 0.75, 1.0}
	biome.ScaleHeightmap(hm, 2.0)
	expected := []float32{0.0, 0.5, 1.0, 1.5, 2.0}
	for i, v := range expected {
		if abs32(hm[i]-v) > 1e-5 {
			t.Errorf("ScaleHeightmap[%d]: got %f, want %f", i, hm[i], v)
		}
	}
}

func TestWorldConfig_Default(t *testing.T) {
	cfg := biome.DefaultWorldConfig()
	if cfg.Seed == 0 {
		t.Error("DefaultWorldConfig should have non-zero seed")
	}
	if cfg.BiomeScale <= 0 {
		t.Error("DefaultWorldConfig should have positive BiomeScale")
	}
}

func abs32(v float32) float32 {
	if v < 0 {
		return -v
	}
	return v
}

func TestGenerateHeightmapPerVertex_SeamContinuity(t *testing.T) {
cfg := terrain.DefaultConfig()
cfg.HeightmapResolution = 17

// Generate two adjacent chunks
hm00, _ := biome.GenerateHeightmapPerVertex(0, 0, cfg, 42)
hm10, _ := biome.GenerateHeightmapPerVertex(1, 0, cfg, 42)

res := cfg.HeightmapResolution
// Right edge of chunk(0,0) must match left edge of chunk(1,0)
for row := range res {
rightEdge := hm00[row*res+(res-1)]
leftEdge := hm10[row*res+0]
diff := rightEdge - leftEdge
if diff < 0 {
diff = -diff
}
if diff > 1e-4 {
t.Errorf("seam discontinuity at row %d: right=%.6f left=%.6f diff=%.6f",
row, rightEdge, leftEdge, diff)
}
}
}

func TestGenerateExtendedHeightmapPerVertex_Size(t *testing.T) {
cfg := terrain.DefaultConfig()
cfg.HeightmapResolution = 17
ext := biome.GenerateExtendedHeightmapPerVertex(0, 0, cfg, 42)
extRes := cfg.HeightmapResolution + 2
want := extRes * extRes
if len(ext) != want {
t.Errorf("expected extended size %d, got %d", want, len(ext))
}
}
