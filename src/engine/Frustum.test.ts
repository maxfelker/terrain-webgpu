import { describe, it, expect } from 'vitest'
import { extractFrustumPlanes, testAABB } from './Frustum'
import mat4 from './math/mat4'

describe('Frustum', () => {
  it('extractFrustumPlanes returns 6 planes', () => {
    const proj = mat4.perspective(Math.PI / 4, 1.0, 0.1, 1000)
    const view = mat4.lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0])
    const viewProj = mat4.multiply(proj, view)
    const planes = extractFrustumPlanes(viewProj)
    expect(planes).toHaveLength(6)
    for (const p of planes) {
      expect(typeof p.nx).toBe('number')
      expect(typeof p.ny).toBe('number')
      expect(typeof p.nz).toBe('number')
      expect(typeof p.d).toBe('number')
    }
  })

  it('box at origin passes a standard perspective frustum', () => {
    const proj = mat4.perspective(Math.PI / 4, 1.0, 0.1, 1000)
    const view = mat4.lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0])
    const viewProj = mat4.multiply(proj, view)
    const planes = extractFrustumPlanes(viewProj)
    const visible = testAABB(planes, -1, -1, -1, 1, 1, 1)
    expect(visible).toBe(true)
  })

  it('box far behind camera fails frustum test', () => {
    const proj = mat4.perspective(Math.PI / 4, 1.0, 0.1, 1000)
    const view = mat4.lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0])
    const viewProj = mat4.multiply(proj, view)
    const planes = extractFrustumPlanes(viewProj)
    // Place box 200 units behind camera (+Z when looking -Z)
    const visible = testAABB(planes, -1, -1, 200, 1, 1, 210)
    expect(visible).toBe(false)
  })
})
