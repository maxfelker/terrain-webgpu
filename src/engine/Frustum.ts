export interface Plane {
  nx: number; ny: number; nz: number; d: number
}

// Extract 6 clip planes from a column-major MVP matrix (Float32Array length 16).
// Uses Gribb/Hartmann method. Returns [left, right, bottom, top, near, far].
// Column-major means: m[row + col*4], so row0 = m[0],m[4],m[8],m[12]
export function extractFrustumPlanes(m: Float32Array): Plane[] {
  // Row vectors from column-major matrix
  const r0x = m[0], r0y = m[4], r0z = m[8],  r0w = m[12]
  const r1x = m[1], r1y = m[5], r1z = m[9],  r1w = m[13]
  const r2x = m[2], r2y = m[6], r2z = m[10], r2w = m[14]
  const r3x = m[3], r3y = m[7], r3z = m[11], r3w = m[15]

  function normalizePlane(nx: number, ny: number, nz: number, d: number): Plane {
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
    return { nx: nx / len, ny: ny / len, nz: nz / len, d: d / len }
  }

  return [
    normalizePlane(r3x + r0x, r3y + r0y, r3z + r0z, r3w + r0w), // left
    normalizePlane(r3x - r0x, r3y - r0y, r3z - r0z, r3w - r0w), // right
    normalizePlane(r3x + r1x, r3y + r1y, r3z + r1z, r3w + r1w), // bottom
    normalizePlane(r3x - r1x, r3y - r1y, r3z - r1z, r3w - r1w), // top
    normalizePlane(r3x + r2x, r3y + r2y, r3z + r2z, r3w + r2w), // near
    normalizePlane(r3x - r2x, r3y - r2y, r3z - r2z, r3w - r2w), // far
  ]
}

// Returns true if the AABB (world space min/max) intersects or is inside the frustum.
export function testAABB(
  planes: Plane[],
  minX: number, minY: number, minZ: number,
  maxX: number, maxY: number, maxZ: number,
): boolean {
  for (const p of planes) {
    // Pick positive vertex: component that maximizes dot with plane normal
    const px = p.nx >= 0 ? maxX : minX
    const py = p.ny >= 0 ? maxY : minY
    const pz = p.nz >= 0 ? maxZ : minZ
    if (p.nx * px + p.ny * py + p.nz * pz + p.d < 0) {
      return false
    }
  }
  return true
}
