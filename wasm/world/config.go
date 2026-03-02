package world

// Constants mirror terra-major World.cs
const (
	InitialRenderRadius = 3072.0
	RenderRadius        = 2560.0
	DistanceThreshold   = 4608.0
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
