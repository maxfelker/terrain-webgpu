package terrain

import "math"

// ComputeNormals returns a flat [resolution*resolution*3] float32 slice of normalized
// per-vertex normals using central differences.
func ComputeNormals(heightmap []float32, resolution int, chunkSize, heightScale float64) []float32 {
	out := make([]float32, resolution*resolution*3)
	spacing := chunkSize / float64(resolution-1)

	sampleH := func(row, col int) float64 {
		row = max(0, min(resolution-1, row))
		col = max(0, min(resolution-1, col))
		return float64(heightmap[row*resolution+col]) * heightScale
	}

	for row := range resolution {
		for col := range resolution {
			hL := sampleH(row, col-1)
			hR := sampleH(row, col+1)
			hD := sampleH(row-1, col)
			hU := sampleH(row+1, col)
			nx := (hL - hR) / (2 * spacing)
			nz := (hD - hU) / (2 * spacing)
			ny := 1.0
			length := math.Sqrt(nx*nx + ny*ny + nz*nz)
			idx := (row*resolution + col) * 3
			out[idx] = float32(nx / length)
			out[idx+1] = float32(ny / length)
			out[idx+2] = float32(nz / length)
		}
	}
	return out
}

// ComputeNormalsFromExtended computes per-vertex normals for a resolution×resolution chunk
// using a (resolution+2)×(resolution+2) extended heightmap that includes a 1-cell border
// from adjacent chunk space. Edge vertices get correct cross-boundary gradients (no clamping).
//
// extHeightmap: output of GenerateExtendedHeightmap — size (resolution+2)²
// Returns: flat float32 slice of size resolution*resolution*3
func ComputeNormalsFromExtended(extHeightmap []float32, resolution int, chunkSize, heightScale float64) []float32 {
	extRes := resolution + 2
	out := make([]float32, resolution*resolution*3)
	spacing := chunkSize / float64(resolution-1)

	// In the extended grid, vertex (row, col) of the normal chunk sits at (row+1, col+1)
	sampleH := func(extRow, extCol int) float64 {
		return float64(extHeightmap[extRow*extRes+extCol]) * heightScale
	}

	for row := range resolution {
		for col := range resolution {
			// Map to extended grid coordinates (offset by 1)
			er := row + 1
			ec := col + 1

			// Central differences — no clamping needed, border always exists
			hL := sampleH(er, ec-1)
			hR := sampleH(er, ec+1)
			hD := sampleH(er-1, ec)
			hU := sampleH(er+1, ec)

			nx := (hL - hR) / (2 * spacing)
			nz := (hD - hU) / (2 * spacing)
			ny := 1.0
			length := math.Sqrt(nx*nx + ny*ny + nz*nz)
			idx := (row*resolution + col) * 3
			out[idx] = float32(nx / length)
			out[idx+1] = float32(ny / length)
			out[idx+2] = float32(nz / length)
		}
	}
	return out
}
