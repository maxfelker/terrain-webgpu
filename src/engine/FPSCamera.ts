import mat4 from './math/mat4'

export interface PlayerState {
  x: number
  y: number
  z: number
  yaw: number
  pitch: number
  velocityY: number
  grounded: boolean
  sprinting: boolean
  coyoteFrames: number
  jumpProgress: number
  flying: boolean
}

const EYE_HEIGHT = 0.8

export default class FPSCamera {
  private aspect = 1
  private fov = Math.PI / 3 // 60 degrees

  setAspect(aspect: number): void {
    this.aspect = aspect
  }

  setFov(degrees: number): void {
    this.fov = (Math.max(10, Math.min(170, degrees)) * Math.PI) / 180
  }

  getEyePosition(state: PlayerState): [number, number, number] {
    return [state.x, state.y + EYE_HEIGHT, state.z]
  }

  getViewMatrix(state: PlayerState): Float32Array {
    const eye = this.getEyePosition(state)
    const sinYaw = Math.sin(state.yaw)
    const cosYaw = Math.cos(state.yaw)
    const cosPitch = Math.cos(state.pitch)
    const sinPitch = Math.sin(state.pitch)
    const dx = -sinYaw * cosPitch
    const dy = sinPitch
    const dz = -cosYaw * cosPitch
    const center: [number, number, number] = [eye[0] + dx, eye[1] + dy, eye[2] + dz]
    return mat4.lookAt(eye, center, [0, 1, 0])
  }

  getProjectionMatrix(): Float32Array {
    return mat4.perspective(this.fov, this.aspect, 0.1, 10000)
  }

  getViewProjMatrix(state: PlayerState): Float32Array {
    const proj = this.getProjectionMatrix()
    const view = this.getViewMatrix(state)
    return mat4.multiply(proj, view)
  }
}
