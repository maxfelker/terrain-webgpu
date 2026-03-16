//go:build js && wasm

package main

import (
	"encoding/json"
	"fmt"
	"math"
	"syscall/js"

	"github.com/maxfelker/terrain-webgpu/wasm/biome"
	"github.com/maxfelker/terrain-webgpu/wasm/physics"
	"github.com/maxfelker/terrain-webgpu/wasm/terrain"
	"github.com/maxfelker/terrain-webgpu/wasm/world"
)

var (
	globalWorld      *world.World
	globalHeightmaps = make(map[world.ChunkCoord][]float32)
	globalPlayer     *physics.PlayerState
	globalWorldCfg   = biome.DefaultWorldConfig()
)

func main() {
	fmt.Println("[WASM] terrain engine starting...")

	js.Global().Set("go_ping", js.FuncOf(goPing))
	js.Global().Set("go_initWorld", js.FuncOf(goInitWorld))
	js.Global().Set("go_worldUpdate", js.FuncOf(goWorldUpdate))
	js.Global().Set("go_generateHeightmap", js.FuncOf(goGenerateHeightmap))
	js.Global().Set("go_computeNormals", js.FuncOf(goComputeNormals))
	js.Global().Set("go_getChunkHeight", js.FuncOf(goGetChunkHeight))
	js.Global().Set("go_generateChunk", js.FuncOf(goGenerateChunk))
	js.Global().Set("go_updatePlayer", js.FuncOf(goUpdatePlayer))
	js.Global().Set("go_loadWorldConfig", js.FuncOf(goLoadWorldConfig))
	js.Global().Set("go_storeHeightmap", js.FuncOf(goStoreHeightmap))

	fmt.Println("[WASM] exports registered, engine ready")
	select {}
}

func goPing(_ js.Value, _ []js.Value) any {
	return "pong"
}

func goLoadWorldConfig(_ js.Value, args []js.Value) any {
	if len(args) == 0 {
		return js.Null()
	}
	defaultCfg := biome.DefaultWorldConfig()
	cfg := defaultCfg
	if err := json.Unmarshal([]byte(args[0].String()), &cfg); err != nil {
		return jsError(err)
	}
	if cfg.BiomeScale <= 0 || math.IsNaN(cfg.BiomeScale) || math.IsInf(cfg.BiomeScale, 0) {
		cfg.BiomeScale = defaultCfg.BiomeScale
	}
	globalWorldCfg = cfg
	return js.Null()
}

func goInitWorld(_ js.Value, args []js.Value) any {
	cfg := terrain.DefaultConfig()
	if len(args) > 0 {
		if err := json.Unmarshal([]byte(args[0].String()), &cfg); err != nil {
			return jsError(err)
		}
	}
	globalWorld = world.New(cfg)
	globalHeightmaps = make(map[world.ChunkCoord][]float32)
	return js.Null()
}

func goWorldUpdate(_ js.Value, args []js.Value) any {
	if globalWorld == nil {
		cfg := terrain.DefaultConfig()
		globalWorld = world.New(cfg)
	}
	playerX := args[0].Float()
	playerZ := args[1].Float()
	update := globalWorld.Update(playerX, playerZ)

	// Clean up heightmap cache for evicted chunks
	for _, c := range update.ChunksToRemove {
		delete(globalHeightmaps, c)
	}

	data, err := json.Marshal(update)
	if err != nil {
		return jsError(err)
	}
	return string(data)
}

func goGenerateHeightmap(_ js.Value, args []js.Value) any {
	var cfg terrain.ChunkConfig
	if err := json.Unmarshal([]byte(args[0].String()), &cfg); err != nil {
		return jsError(err)
	}
	cx := args[1].Int()
	cz := args[2].Int()
	hm := terrain.GenerateHeightmap(cx, cz, cfg)
	return float32SliceToJS(hm)
}

func goComputeNormals(_ js.Value, args []js.Value) any {
	buf := args[0]
	length := buf.Get("length").Int()
	hm := make([]float32, length)
	for i := range length {
		hm[i] = float32(buf.Index(i).Float())
	}
	resolution := args[1].Int()
	chunkSize := args[2].Float()
	heightScale := args[3].Float()
	normals := terrain.ComputeNormals(hm, resolution, chunkSize, heightScale)
	return float32SliceToJS(normals)
}

func goGetChunkHeight(_ js.Value, args []js.Value) any {
	if globalWorld == nil {
		return 0.0
	}
	worldX := args[0].Float()
	worldZ := args[1].Float()
	return globalWorld.SampleHeight(worldX, worldZ, globalHeightmaps)
}

// goGenerateChunk generates heightmap and normals entirely in Go using pure Go slices.
// This avoids passing JS typed arrays between Go WASM function calls, which can
// produce empty arrays due to syscall/js value lifecycle behaviour.
//
// Args: configJSON string, chunkX int, chunkZ int, resolution int, chunkSize int, heightScale float64
// Returns: flat Float32Array [heightmap(res×res)..., normals(res×res×3)..., primaryBiomeId(1), secondaryBiomeId(1), blendFactor(1)]
// TypeScript splits via hm/normals by fixed lengths then decodes final 3 metadata values.
func goGenerateChunk(_ js.Value, args []js.Value) any {
	cfg := terrain.DefaultConfig()
	cfgStr := args[0].String()
	if cfgStr != "" && cfgStr != "{}" {
		if err := json.Unmarshal([]byte(cfgStr), &cfg); err != nil {
			return jsError(err)
		}
	}
	cx := args[1].Int()
	cz := args[2].Int()
	resolution := args[3].Int()
	chunkSize := args[4].Int()
	heightScale := args[5].Float()

	cfg.HeightmapResolution = resolution
	cfg.Dimension = chunkSize
	cfg.Height = int(heightScale)

	// Use world config seed for biome placement, falling back to terrain seed.
	biomeSeed := globalWorldCfg.Seed
	if biomeSeed == 0 {
		biomeSeed = cfg.Seed
	}

	// Per-vertex biome sampling ensures seamless chunk boundaries.
	// Both sides of a shared edge compute height at the same world coordinate
	// → same biome → same noise config → matching heights, no gaps.
	biomeScale := globalWorldCfg.BiomeScale
	hm, biomeTransition := biome.GenerateHeightmapPerVertexWithScale(cx, cz, cfg, biomeSeed, biomeScale)
	extHm := biome.GenerateExtendedHeightmapPerVertexWithScale(cx, cz, cfg, biomeSeed, biomeScale)

	// Normals are computed from the extended heightmap. The effective height scale
	// varies per vertex (biome height multiplier × base heightScale), but we pass
	// the base heightScale here; the vertex heights already encode the multiplier
	// so the gradient magnitudes remain physically correct.
	normals := terrain.ComputeNormalsFromExtended(extHm, resolution, float64(chunkSize), heightScale)

	// Store heightmap so physics can sample terrain height for collision/spawning.
	coord := world.ChunkCoord{X: cx, Z: cz}
	globalHeightmaps[coord] = hm
	if globalWorld != nil {
		globalWorld.SetHeight(int(heightScale))
	}

	// Return as a single flat Float32Array: [heightmap..., normals..., primaryBiomeId, secondaryBiomeId, blendFactor]
	combined := make([]float32, len(hm)+len(normals)+3)
	copy(combined, hm)
	copy(combined[len(hm):], normals)
	metadataOffset := len(hm) + len(normals)
	combined[metadataOffset] = float32(biomeTransition.PrimaryBiomeID)
	combined[metadataOffset+1] = float32(biomeTransition.SecondaryBiomeID)
	combined[metadataOffset+2] = biomeTransition.BlendFactor
	return float32SliceToJS(combined)
}

func float32SliceToJS(s []float32) js.Value {
	buf := js.Global().Get("Float32Array").New(len(s))
	for i, v := range s {
		buf.SetIndex(i, v)
	}
	return buf
}

func jsError(err error) js.Value {
	jsErr := js.Global().Get("Error").New(err.Error())
	return jsErr
}

func goUpdatePlayer(_ js.Value, args []js.Value) any {
	if globalPlayer == nil {
		h := 0.0
		if globalWorld != nil {
			h = globalWorld.SampleHeight(256.0, 256.0, globalHeightmaps)
		}
		globalPlayer = &physics.PlayerState{
			X: 256.0,
			Y: h + physics.CapsuleHalfHeight + physics.CapsuleRadius + 0.5,
			Z: 256.0,
		}
	}

	if len(args) < 2 {
		return jsError(fmt.Errorf("go_updatePlayer requires (inputJSON, dt)"))
	}

	var input physics.InputState
	if err := json.Unmarshal([]byte(args[0].String()), &input); err != nil {
		return jsError(err)
	}
	dt := args[1].Float()
	if dt > 0.1 {
		dt = 0.1
	}

	heightAt := func(x, z float64) float64 {
		if globalWorld == nil {
			return 0
		}
		return globalWorld.SampleHeight(x, z, globalHeightmaps)
	}

	physics.Update(globalPlayer, input, dt, heightAt)

	out, err := json.Marshal(globalPlayer)
	if err != nil {
		return jsError(err)
	}
	return string(out)
}

// goStoreHeightmap receives a heightmap generated by a pool worker and stores it
// in the primary worker's globalHeightmaps so physics collision detection works.
func goStoreHeightmap(_ js.Value, args []js.Value) any {
	cx := args[0].Int()
	cz := args[1].Int()
	jsArr := args[2] // Float32Array from TypeScript

	n := jsArr.Get("length").Int()
	hm := make([]float32, n)

	// Use Uint8Array view of the Float32Array's buffer for efficient bulk copy.
	byteLen := jsArr.Get("byteLength").Int()
	byteOffset := jsArr.Get("byteOffset").Int()
	uint8View := js.Global().Get("Uint8Array").New(jsArr.Get("buffer"), byteOffset, byteLen)
	goBytes := make([]byte, byteLen)
	js.CopyBytesToGo(goBytes, uint8View)

	// Reinterpret little-endian bytes as float32 values.
	for i := range hm {
		b := goBytes[i*4 : i*4+4]
		bits := uint32(b[0]) | uint32(b[1])<<8 | uint32(b[2])<<16 | uint32(b[3])<<24
		hm[i] = math.Float32frombits(bits)
	}

	coord := world.ChunkCoord{X: cx, Z: cz}
	globalHeightmaps[coord] = hm
	return nil
}

// ensure math import is used
var _ = math.Floor
