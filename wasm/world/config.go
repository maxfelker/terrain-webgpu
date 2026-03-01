package world

// Constants mirror terra-major World.cs
const (
	InitialRenderRadius = 2048.0
	RenderRadius        = 512.0
	DistanceThreshold   = 1100.0
	MaxConcurrentChunks = 3
)

// ChunkCoord identifies a chunk by grid position.
type ChunkCoord struct {
	X int `json:"x"`
	Z int `json:"z"`
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
