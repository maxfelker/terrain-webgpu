package biome

import "math"

type biomeAdjacencyRule struct {
	left   BiomeType
	right  BiomeType
	buffer BiomeType
}

var biomeAdjacencyRules = [...]biomeAdjacencyRule{
	{left: Desert, right: Swamp, buffer: Grassland},
}

// applyAdjacencyBuffering enforces explicit biome adjacency rules by moving
// conflicting influence into an allowed buffer biome.
func applyAdjacencyBuffering(weights [6]float64) [6]float64 {
	adjusted := weights
	for _, rule := range biomeAdjacencyRules {
		leftIdx := int(rule.left)
		rightIdx := int(rule.right)
		bufferIdx := int(rule.buffer)

		leftWeight := adjusted[leftIdx]
		rightWeight := adjusted[rightIdx]
		if leftWeight <= 0 || rightWeight <= 0 {
			continue
		}

		transfer := math.Min(leftWeight, rightWeight)
		adjusted[leftIdx] -= transfer
		adjusted[rightIdx] -= transfer
		adjusted[bufferIdx] += 2 * transfer
	}
	return adjusted
}
