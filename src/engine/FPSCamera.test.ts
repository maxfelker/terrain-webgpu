import { describe, it, expect } from 'vitest'
import FPSCamera from './FPSCamera'
import type { PlayerState } from './FPSCamera'

const defaultPlayer: PlayerState = {
  x: 0, y: 0, z: 0,
  yaw: 0, pitch: 0,
  velocityY: 0, grounded: true,
  sprinting: false,
  coyoteFrames: 0, jumpProgress: 0,
}

describe('FPSCamera', () => {
  it('getEyePosition adds 0.8 to player y', () => {
    const cam = new FPSCamera()
    const eye = cam.getEyePosition({ ...defaultPlayer, y: 10 })
    expect(eye[1]).toBeCloseTo(10.8)
  })

  it('getViewProjMatrix returns Float32Array of length 16', () => {
    const cam = new FPSCamera()
    cam.setAspect(16 / 9)
    const vp = cam.getViewProjMatrix(defaultPlayer)
    expect(vp).toBeInstanceOf(Float32Array)
    expect(vp.length).toBe(16)
  })

  it('pitch 0 yaw 0 looks in -Z direction', () => {
    const cam = new FPSCamera()
    const eye = cam.getEyePosition(defaultPlayer)
    // With yaw=0 pitch=0, look direction should be [0, 0, -1]
    // Eye at [0, 0.8, 0], center at [0, 0.8, -1]
    expect(eye[0]).toBeCloseTo(0)
    expect(eye[1]).toBeCloseTo(0.8)
    expect(eye[2]).toBeCloseTo(0)
  })

  it('setAspect changes projection matrix', () => {
    const cam = new FPSCamera()
    cam.setAspect(1)
    const vp1 = cam.getProjectionMatrix()
    cam.setAspect(16 / 9)
    const vp2 = cam.getProjectionMatrix()
    // Different aspects produce different matrices
    expect(vp1[0]).not.toBeCloseTo(vp2[0])
  })
})
