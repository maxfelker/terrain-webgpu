package biome

import (
	"math"
	"testing"
)

func TestChunkBiomeTransitionFromWeights_SelectsTopTwo(t *testing.T) {
	weights := [6]float64{
		0.52, // Grassland
		0.31, // Desert
		0.05, // Mountains
		0.04, // Valley
		0.03, // Swamp
		0.05, // Forest
	}

	transition := ChunkBiomeTransitionFromWeights(weights)

	if transition.PrimaryBiomeID != Grassland {
		t.Fatalf("expected primary biome Grassland, got %d", transition.PrimaryBiomeID)
	}
	if transition.SecondaryBiomeID != Desert {
		t.Fatalf("expected secondary biome Desert, got %d", transition.SecondaryBiomeID)
	}

	expectedBlend := float32(weights[Desert] / (weights[Grassland] + weights[Desert]))
	if math.Abs(float64(transition.BlendFactor-expectedBlend)) > 1e-6 {
		t.Fatalf("expected blend factor %.6f, got %.6f", expectedBlend, transition.BlendFactor)
	}
}

func TestChunkBiomeTransitionFromWeights_TieBreaksByBiomeID(t *testing.T) {
	weights := [6]float64{
		0.4, // Grassland
		0.4, // Desert
		0.1, // Mountains
		0.1, // Valley
		0.0, // Swamp
		0.0, // Forest
	}

	transition := ChunkBiomeTransitionFromWeights(weights)

	if transition.PrimaryBiomeID != Grassland {
		t.Fatalf("expected primary biome Grassland for tie-break, got %d", transition.PrimaryBiomeID)
	}
	if transition.SecondaryBiomeID != Desert {
		t.Fatalf("expected secondary biome Desert for tie-break, got %d", transition.SecondaryBiomeID)
	}
	if math.Abs(float64(transition.BlendFactor-0.5)) > 1e-6 {
		t.Fatalf("expected blend factor 0.5 for equal top-2 weights, got %.6f", transition.BlendFactor)
	}
}

func TestChunkBiomeTransitionFromWeights_NoSecondaryWeight(t *testing.T) {
	weights := [6]float64{
		0.0, // Grassland
		0.0, // Desert
		0.0, // Mountains
		1.0, // Valley
		0.0, // Swamp
		0.0, // Forest
	}

	transition := ChunkBiomeTransitionFromWeights(weights)

	if transition.PrimaryBiomeID != Valley {
		t.Fatalf("expected primary biome Valley, got %d", transition.PrimaryBiomeID)
	}
	if transition.SecondaryBiomeID != Valley {
		t.Fatalf("expected secondary biome to collapse to primary, got %d", transition.SecondaryBiomeID)
	}
	if transition.BlendFactor != 0 {
		t.Fatalf("expected blend factor 0 when no secondary weight, got %.6f", transition.BlendFactor)
	}
}

func TestGetBiomeParamsWithScale_ScalesSamplingCoordinates(t *testing.T) {
	const (
		seed    = 42
		worldX  = 8364.5
		worldZ  = -2931.75
		scale   = 2.75
		epsilon = 1e-9
	)

	scaledTemp, scaledHumid := GetBiomeParamsWithScale(worldX, worldZ, seed, scale)
	equivalentTemp, equivalentHumid := GetBiomeParamsWithScale(worldX/scale, worldZ/scale, seed, 1.0)

	if math.Abs(scaledTemp-equivalentTemp) > epsilon || math.Abs(scaledHumid-equivalentHumid) > epsilon {
		t.Fatalf(
			"scaled sampling mismatch: got (%.9f, %.9f), want (%.9f, %.9f)",
			scaledTemp, scaledHumid, equivalentTemp, equivalentHumid,
		)
	}

	defaultTemp, defaultHumid := GetBiomeParamsWithScale(worldX, worldZ, seed, 1.0)
	if math.Abs(scaledTemp-defaultTemp) < 1e-6 && math.Abs(scaledHumid-defaultHumid) < 1e-6 {
		t.Fatal("biomeScale did not change sampled biome parameters")
	}
}

func TestGetBiomeParamsWithScale_InvalidScaleFallsBackToDefault(t *testing.T) {
	const (
		seed   = 99
		worldX = 2048.25
		worldZ = -1024.75
	)

	baseTemp, baseHumid := GetBiomeParamsWithScale(worldX, worldZ, seed, 1.0)
	invalidScales := []float64{0, -2, math.NaN(), math.Inf(1), math.Inf(-1)}

	for _, invalidScale := range invalidScales {
		temp, humid := GetBiomeParamsWithScale(worldX, worldZ, seed, invalidScale)
		if math.Abs(temp-baseTemp) > 1e-9 || math.Abs(humid-baseHumid) > 1e-9 {
			t.Fatalf(
				"invalid biomeScale %v should fallback to default; got (%.9f, %.9f), want (%.9f, %.9f)",
				invalidScale, temp, humid, baseTemp, baseHumid,
			)
		}
	}
}
