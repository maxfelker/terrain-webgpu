package world_test

import (
	"testing"

	"github.com/maxfelker/terrain-webgpu/wasm/terrain"
	"github.com/maxfelker/terrain-webgpu/wasm/world"
)

func testWorld() *world.World {
	cfg := terrain.DefaultConfig()
	cfg.HeightmapResolution = 9
	cfg.Dimension = 64
	return world.New(cfg)
}

func TestWorld_UpdateAddsChunks(t *testing.T) {
	w := testWorld()
	update := w.Update(0, 0)
	if len(update.ChunksToAdd) == 0 {
		t.Error("expected chunks to be added near origin, got none")
	}
}

func TestWorld_NoDuplicateChunks(t *testing.T) {
	w := testWorld()
	u1 := w.Update(0, 0)
	u2 := w.Update(0, 0)
	if len(u2.ChunksToAdd) != 0 {
		t.Errorf("second update at same position added %d chunks (expected 0)", len(u2.ChunksToAdd))
	}
	_ = u1
}

func TestRegistry_StateMachine(t *testing.T) {
	r := world.NewRegistry()
	coord := world.ChunkCoord{X: 1, Z: 1}

	if r.IsActive(coord) {
		t.Error("chunk should not be active before any state change")
	}
	r.MarkGenerating(coord)
	r.MarkReady(coord)
	r.MarkActive(coord)
	if !r.IsActive(coord) {
		t.Error("chunk should be active after MarkActive")
	}
	r.Remove(coord)
	if r.IsActive(coord) {
		t.Error("chunk should not be active after Remove")
	}
}

func TestRegistry_MaxConcurrent(t *testing.T) {
	r := world.NewRegistry()
	for i := range world.MaxConcurrentChunks {
		r.MarkGenerating(world.ChunkCoord{X: i, Z: 0})
	}
	if r.CanDispatch() {
		t.Error("should not be able to dispatch when at max concurrent chunks")
	}
}
