package world

import (
	"math"

	"github.com/maxfelker/terrain-webgpu/wasm/terrain"
)

// ChunkGenResult is the data returned when a chunk is generated.
type ChunkGenResult struct {
	Coord     ChunkCoord `json:"coord"`
	Heightmap []float32  `json:"-"`
	Normals   []float32  `json:"-"`
}

// WorldUpdate is what gets returned to TypeScript after each tick.
type WorldUpdate struct {
	ChunksToAdd    []ChunkGenResult `json:"chunksToAdd"`
	ChunksToRemove []ChunkCoord     `json:"chunksToRemove"`
}

// World manages chunk streaming around the player position.
type World struct {
	registry *Registry
	cfg      terrain.ChunkConfig
}

func New(cfg terrain.ChunkConfig) *World {
	return &World{
		registry: NewRegistry(),
		cfg:      cfg,
	}
}

// SetHeight updates the world's height scale to match the chunk generation parameters.
func (w *World) SetHeight(h int) {
	w.cfg.Height = h
}

// Update computes which chunks to add/remove based on player position.
func (w *World) Update(playerX, playerZ float64) WorldUpdate {
	chunkSize := float64(w.cfg.Dimension)
	playerChunkX := int(math.Floor(playerX / chunkSize))
	playerChunkZ := int(math.Floor(playerZ / chunkSize))

	radius := int(math.Ceil(RenderRadius / chunkSize))
	toAdd := make([]ChunkGenResult, 0)

	for dz := -radius; dz <= radius; dz++ {
		for dx := -radius; dx <= radius; dx++ {
			cx := playerChunkX + dx
			cz := playerChunkZ + dz

			worldDX := float64(cx)*chunkSize - playerX
			worldDZ := float64(cz)*chunkSize - playerZ
			if worldDX*worldDX+worldDZ*worldDZ > RenderRadius*RenderRadius {
				continue
			}

			coord := ChunkCoord{X: cx, Z: cz}
			if w.registry.IsActive(coord) {
				continue
			}
			if !w.registry.CanDispatch() {
				break
			}

			w.registry.MarkGenerating(coord)
			hm := terrain.GenerateHeightmap(cx, cz, w.cfg)
			normals := terrain.ComputeNormals(hm, w.cfg.HeightmapResolution, float64(w.cfg.Dimension), float64(w.cfg.Height))
			w.registry.MarkReady(coord)
			w.registry.MarkActive(coord)

			toAdd = append(toAdd, ChunkGenResult{
				Coord:     coord,
				Heightmap: hm,
				Normals:   normals,
			})
		}
	}

	// Evict chunks beyond distance threshold
	toRemove := make([]ChunkCoord, 0)
	for _, coord := range w.registry.ActiveCoords() {
		worldDX := float64(coord.X)*chunkSize - playerX
		worldDZ := float64(coord.Z)*chunkSize - playerZ
		if worldDX*worldDX+worldDZ*worldDZ > DistanceThreshold*DistanceThreshold {
			w.registry.Remove(coord)
			toRemove = append(toRemove, coord)
		}
	}

	return WorldUpdate{ChunksToAdd: toAdd, ChunksToRemove: toRemove}
}

// SampleHeight bilinearly samples the terrain height at world coordinates.
func (w *World) SampleHeight(worldX, worldZ float64, heightmaps map[ChunkCoord][]float32) float64 {
	chunkSize := float64(w.cfg.Dimension)
	cx := int(math.Floor(worldX / chunkSize))
	cz := int(math.Floor(worldZ / chunkSize))
	coord := ChunkCoord{X: cx, Z: cz}
	hm, ok := heightmaps[coord]
	if !ok {
		return 0
	}
	localX := (worldX - float64(cx)*chunkSize) / chunkSize
	localZ := (worldZ - float64(cz)*chunkSize) / chunkSize
	return terrain.GetHeight(localX, localZ, hm, w.cfg.HeightmapResolution, float64(w.cfg.Height))
}
