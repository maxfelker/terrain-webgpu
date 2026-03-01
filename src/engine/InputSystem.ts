// Tracks keyboard state and accumulates mouse delta each frame.
export interface InputSnapshot {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  jump: boolean
  sprint: boolean
  mouseDX: number
  mouseDY: number
}

export default class InputSystem {
  private keys = new Set<string>()
  private mouseDX = 0
  private mouseDY = 0
  private canvas: HTMLCanvasElement | null = null

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code)
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code)
  }

  private onMouseMove = (e: MouseEvent): void => {
    if (document.pointerLockElement === this.canvas) {
      this.mouseDX += e.movementX
      this.mouseDY += e.movementY
    }
  }

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    document.addEventListener('mousemove', this.onMouseMove)
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    document.removeEventListener('mousemove', this.onMouseMove)
    this.canvas = null
  }

  // Returns current snapshot and resets mouse deltas
  flush(): InputSnapshot {
    const snap: InputSnapshot = {
      forward:  this.keys.has('KeyW')  || this.keys.has('ArrowUp'),
      backward: this.keys.has('KeyS')  || this.keys.has('ArrowDown'),
      left:     this.keys.has('KeyA')  || this.keys.has('ArrowLeft'),
      right:    this.keys.has('KeyD')  || this.keys.has('ArrowRight'),
      jump:     this.keys.has('Space'),
      sprint:   this.keys.has('ShiftLeft'),
      mouseDX:  this.mouseDX,
      mouseDY:  this.mouseDY,
    }
    this.mouseDX = 0
    this.mouseDY = 0
    return snap
  }
}
