import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, it, expect, vi } from 'vitest'
import GameCanvas from './GameCanvas'

describe('GameCanvas', () => {
  it('renders a canvas element', () => {
    const ref = createRef<HTMLCanvasElement>()
    render(<GameCanvas ref={ref} />)
    expect(screen.getByRole('presentation')).toBeInTheDocument()
  })

  it('calls onPointerLock when pointer lock changes', () => {
    const ref = createRef<HTMLCanvasElement>()
    const onPointerLock = vi.fn()
    render(<GameCanvas ref={ref} onPointerLock={onPointerLock} />)
    Object.defineProperty(document, 'pointerLockElement', {
      configurable: true,
      get: () => null,
    })
    document.dispatchEvent(new Event('pointerlockchange'))
    expect(onPointerLock).toHaveBeenCalledWith(false)
  })
})
