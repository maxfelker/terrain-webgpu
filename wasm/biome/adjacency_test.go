package biome

import (
	"math"
	"testing"
)

func TestApplyAdjacencyBuffering_ConflictingPairUsesBuffer(t *testing.T) {
	weights := [6]float64{
		0.08, // Grassland
		0.44, // Desert
		0.02, // Mountains
		0.02, // Valley
		0.40, // Swamp
		0.04, // Forest
	}

	buffered := applyAdjacencyBuffering(weights)

	if buffered[Desert] > 0 && buffered[Swamp] > 0 {
		t.Fatalf("desert and swamp still directly co-dominate after buffering: desert=%f swamp=%f", buffered[Desert], buffered[Swamp])
	}

	expectedGrassland := weights[Grassland] + 2*math.Min(weights[Desert], weights[Swamp])
	if math.Abs(buffered[Grassland]-expectedGrassland) > 1e-12 {
		t.Fatalf("grassland buffer weight mismatch: got=%f want=%f", buffered[Grassland], expectedGrassland)
	}

	if dominant := dominantBiomeFromWeights(buffered); dominant != Grassland {
		t.Fatalf("expected buffered dominant biome to be Grassland, got %v", dominant)
	}
}

func TestGaussianBiomeWeights_AdjacencyBufferingStaysNormalized(t *testing.T) {
	testPoints := [][2]float64{
		{0.82, 0.14},
		{0.72, 0.50},
		{0.62, 0.86},
		{0.50, 0.50},
	}

	for _, point := range testPoints {
		weights := gaussianBiomeWeights(point[0], point[1])
		sum := 0.0
		for _, w := range weights {
			sum += w
		}
		if math.Abs(sum-1.0) > 1e-9 {
			t.Fatalf("weights should stay normalized at (%f,%f): got sum=%f", point[0], point[1], sum)
		}
	}
}

func TestGaussianBiomeWeights_AdjacencyBufferingDeterministic(t *testing.T) {
	first := gaussianBiomeWeights(0.72, 0.50)
	for i := 0; i < 20; i++ {
		next := gaussianBiomeWeights(0.72, 0.50)
		if next != first {
			t.Fatalf("gaussian biome weights changed between runs: first=%v next=%v", first, next)
		}
	}
}
