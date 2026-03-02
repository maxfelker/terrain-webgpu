package biome

import (
	"github.com/maxfelker/terrain-webgpu/wasm/noise"
)

const (
	biomeNoiseScale = 0.0002  // low frequency → large biome regions (~5000 units wide)
	warpNoiseScale  = 0.0008  // warp frequency
	warpStrength    = 150.0   // coordinate warp magnitude in world units
)

// GetBiomeAt returns the BiomeType for a world-space position.
// Uses two low-frequency noise maps (temperature, humidity) with domain warping
// to create organic, curved biome boundaries.
func GetBiomeAt(worldX, worldZ float64, seed int) BiomeType {
	t, h := GetBiomeParams(worldX, worldZ, seed)
	return ClassifyBiome(t, h)
}

// GetBiomeParams returns the raw temperature [0,1] and humidity [0,1] noise
// values at a world position after applying domain warping. These continuous
// values are used for smooth biome blending.
func GetBiomeParams(worldX, worldZ float64, seed int) (temperature, humidity float64) {
	// Domain warping: shift sample coordinates to create non-linear biome boundaries.
	// Pass raw world coords; FBm handles frequency scaling internally.
	wx := noise.FBm(worldX, worldZ, seed+1001, 3, warpNoiseScale, 2.0, 0.5)
	wz := noise.FBm(worldX+500000, worldZ+500000, seed+1001, 3, warpNoiseScale, 2.0, 0.5)
	sx := worldX + wx*warpStrength
	sz := worldZ + wz*warpStrength

	// Temperature noise — seed offset to differ from terrain and humidity noise.
	tempRaw := noise.FBm(sx, sz, seed+1000, 3, biomeNoiseScale, 2.0, 0.5)
	temperature = (tempRaw + 1.0) * 0.5

	// Humidity noise — large offset to de-correlate from temperature.
	humidRaw := noise.FBm(sx+500000, sz+500000, seed+2000, 3, biomeNoiseScale, 2.0, 0.5)
	humidity = (humidRaw + 1.0) * 0.5
	return
}

// ClassifyBiome maps temperature [0,1] and humidity [0,1] to a BiomeType
// using a simplified Whittaker biome classification chart.
// temperature: 0=cold, 1=hot; humidity: 0=dry, 1=wet.
func ClassifyBiome(temperature, humidity float64) BiomeType {
	switch {
	case temperature > 0.65 && humidity < 0.30:
		return Desert
	case temperature < 0.28:
		return Mountains
	case humidity > 0.72:
		return Swamp
	case humidity > 0.50 && temperature >= 0.40:
		return Forest
	case temperature >= 0.35 && temperature <= 0.62 && humidity < 0.40:
		return Valley
	default:
		return Grassland
	}
}
