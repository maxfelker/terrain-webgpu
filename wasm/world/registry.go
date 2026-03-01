package world

import (
	"sync"
)

// chunkEntry tracks a chunk's lifecycle.
type chunkEntry struct {
	coord  ChunkCoord
	status ChunkStatus
}

// Registry manages chunk lifecycle, mirroring terra-major ChunkCache.
type Registry struct {
	mu       sync.Mutex
	chunks   map[ChunkCoord]*chunkEntry
	active   map[ChunkCoord]bool
	inflight int
}

func NewRegistry() *Registry {
	return &Registry{
		chunks: make(map[ChunkCoord]*chunkEntry),
		active: make(map[ChunkCoord]bool),
	}
}

func (r *Registry) IsActive(coord ChunkCoord) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.active[coord]
}

func (r *Registry) CanDispatch() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.inflight < MaxConcurrentChunks
}

func (r *Registry) MarkGenerating(coord ChunkCoord) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.chunks[coord] = &chunkEntry{coord: coord, status: StatusGenerating}
	r.inflight++
}

func (r *Registry) MarkReady(coord ChunkCoord) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if e, ok := r.chunks[coord]; ok {
		e.status = StatusReady
		r.inflight--
		if r.inflight < 0 {
			r.inflight = 0
		}
	}
}

func (r *Registry) MarkActive(coord ChunkCoord) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if e, ok := r.chunks[coord]; ok {
		e.status = StatusActive
	}
	r.active[coord] = true
}

func (r *Registry) Remove(coord ChunkCoord) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.chunks, coord)
	delete(r.active, coord)
}

func (r *Registry) ActiveCoords() []ChunkCoord {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]ChunkCoord, 0, len(r.active))
	for c := range r.active {
		out = append(out, c)
	}
	return out
}
