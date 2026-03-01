import { describe, it, expect } from 'vitest'
import MeshBuilder from './MeshBuilder'

describe('MeshBuilder', () => {
  const resolution = 3
  const chunkSize = 512
  const heightScale = 64
  const heightmap = new Float32Array([0, 0, 0, 0, 0.5, 0, 0, 0, 0])
  const normals = (() => {
    const arr = new Float32Array(resolution * resolution * 3)
    for (let i = 0; i < resolution * resolution; i++) arr[i * 3 + 1] = 1
    return arr
  })()

  describe('buildVertexBuffer', () => {
    it('produces resolution² vertices × 8 floats', () => {
      const { data, vertexCount } = MeshBuilder.buildVertexBuffer(heightmap, normals, resolution, chunkSize, heightScale)
      expect(vertexCount).toBe(9)
      expect(data.length).toBe(72)
    })

    it('U and V values are in [0, 1]', () => {
      const { data } = MeshBuilder.buildVertexBuffer(heightmap, normals, resolution, chunkSize, heightScale)
      for (let i = 0; i < 9; i++) {
        const u = data[i * 8 + 6]
        const v = data[i * 8 + 7]
        expect(u).toBeGreaterThanOrEqual(0)
        expect(u).toBeLessThanOrEqual(1)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    })

    it('center vertex height is > 0 when heightmap has non-zero values', () => {
      const { data } = MeshBuilder.buildVertexBuffer(heightmap, normals, resolution, chunkSize, heightScale)
      const centerY = data[4 * 8 + 1]
      expect(centerY).toBeGreaterThan(0)
    })
  })

  describe('buildIndexBuffer', () => {
    it('produces (resolution-1)² × 6 indices', () => {
      const { data, indexCount } = MeshBuilder.buildIndexBuffer(resolution)
      expect(indexCount).toBe(24)
      expect(data.length).toBe(24)
    })

    it('all indices are < vertexCount (9)', () => {
      const { data } = MeshBuilder.buildIndexBuffer(resolution)
      for (const idx of data) {
        expect(idx).toBeLessThan(9)
      }
    })

    it('max index is exactly resolution²-1 = 8', () => {
      const { data } = MeshBuilder.buildIndexBuffer(resolution)
      const max = Math.max(...data)
      expect(max).toBe(8)
    })
  })
})
