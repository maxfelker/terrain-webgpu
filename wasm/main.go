//go:build js && wasm

package main

import (
	"encoding/json"
	"fmt"
	"syscall/js"

	"github.com/maxfelker/terrain-webgpu/wasm/terrain"
	"github.com/maxfelker/terrain-webgpu/wasm/world"
)

var (
	globalWorld      *world.World
	globalHeightmaps = make(map[world.ChunkCoord][]float32)
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

	fmt.Println("[WASM] exports registered, engine ready")
	select {}
}

func goPing(_ js.Value, _ []js.Value) any {
	return "pong"
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

	for _, r := range update.ChunksToAdd {
		globalHeightmaps[r.Coord] = r.Heightmap
	}
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
// Returns: flat Float32Array [heightmap(res×res)..., normals(res×res×3)...]
// TypeScript splits via: hm = buf.subarray(0, res*res), normals = buf.subarray(res*res)
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

	hm := terrain.GenerateHeightmap(cx, cz, cfg)
	normals := terrain.ComputeNormals(hm, resolution, float64(chunkSize), heightScale)

	// Return as a single flat Float32Array: [heightmap..., normals...]
	combined := make([]float32, len(hm)+len(normals))
	copy(combined, hm)
	copy(combined[len(hm):], normals)
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
