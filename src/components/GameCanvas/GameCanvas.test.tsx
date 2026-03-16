import { render, screen, fireEvent } from '@testing-library/react'
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

  it('calls onWorldConfigApply when settings applies world config', () => {
    const ref = createRef<HTMLCanvasElement>()
    const onWorldConfigApply = vi.fn()
    render(<GameCanvas ref={ref} onWorldConfigApply={onWorldConfigApply} />)

    fireEvent.click(screen.getByRole('button', { name: /settings/i }))
    fireEvent.change(screen.getByTestId('input-world-seed'), { target: { value: '9876' } })
    fireEvent.change(screen.getByTestId('input-biome-scale'), { target: { value: '3.5' } })
    fireEvent.click(screen.getByRole('button', { name: /apply world config/i }))

    expect(onWorldConfigApply).toHaveBeenCalledWith({ seed: 9876, biomeScale: 3.5 })
  })
})
