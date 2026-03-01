export interface VertexBufferResult {
  data: Float32Array
  vertexCount: number
}

export interface IndexBufferResult {
  data: Uint32Array
  indexCount: number
}

// stride: [x, y, z, nx, ny, nz, u, v] = 8 floats per vertex
function buildVertexBuffer(
  heightmap: Float32Array,
  normals: Float32Array,
  resolution: number,
  chunkSize: number,
  heightScale: number,
): VertexBufferResult {
  const vertexCount = resolution * resolution
  const data = new Float32Array(vertexCount * 8)
  const step = chunkSize / (resolution - 1)
  for (let row = 0; row < resolution; row++) {
    for (let col = 0; col < resolution; col++) {
      const i = row * resolution + col
      const base = i * 8
      data[base + 0] = col * step
      data[base + 1] = heightmap[i] * heightScale
      data[base + 2] = row * step
      data[base + 3] = normals[i * 3 + 0]
      data[base + 4] = normals[i * 3 + 1]
      data[base + 5] = normals[i * 3 + 2]
      data[base + 6] = col / (resolution - 1)
      data[base + 7] = row / (resolution - 1)
    }
  }
  return { data, vertexCount }
}

function buildIndexBuffer(resolution: number): IndexBufferResult {
  const quads = (resolution - 1) * (resolution - 1)
  const indexCount = quads * 6
  const data = new Uint32Array(indexCount)
  let idx = 0
  for (let row = 0; row < resolution - 1; row++) {
    for (let col = 0; col < resolution - 1; col++) {
      const tl = row * resolution + col
      const bl = (row + 1) * resolution + col
      const tr = row * resolution + (col + 1)
      const br = (row + 1) * resolution + (col + 1)
      data[idx++] = tl; data[idx++] = bl; data[idx++] = tr
      data[idx++] = bl; data[idx++] = br; data[idx++] = tr
    }
  }
  return { data, indexCount }
}

export default { buildVertexBuffer, buildIndexBuffer }
