package world

// Constants mirror terra-major World.cs
const (
	InitialRenderRadius = 2048.0
	RenderRadius        = 1536.0
	DistanceThreshold   = 2560.0
	MaxConcurrentChunks = 64
)

// ChunkCoord identifies a chunk by grid position.
type ChunkCoord struct {
	X int `json:"X"`
	Z int `json:"Z"`
}

// ChunkStatus represents the chunk lifecycle state.
type ChunkStatus int

const (
	StatusRequested ChunkStatus = iota
	StatusGenerating
	StatusReady
	StatusUploaded
	StatusActive
)
