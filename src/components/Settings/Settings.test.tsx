import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SettingsPanel from './Settings'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()

beforeEach(() => {
  localStorageMock.clear()
  vi.restoreAllMocks()
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    configurable: true,
    writable: true,
  })
})

describe('SettingsPanel', () => {
  it('renders the toggle button', () => {
    render(<SettingsPanel />)
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument()
  })

  it('panel is hidden by default', () => {
    render(<SettingsPanel />)
    expect(screen.queryByTestId('settings-panel')).not.toBeInTheDocument()
  })

  it('opens panel on toggle click', () => {
    render(<SettingsPanel />)
    fireEvent.click(screen.getByRole('button', { name: /settings/i }))
    expect(screen.getByTestId('settings-panel')).toBeInTheDocument()
  })

  it('calls onFogDensityChange when fog slider changes', () => {
    const onFog = vi.fn()
    render(<SettingsPanel onFogDensityChange={onFog} />)
    fireEvent.click(screen.getByRole('button', { name: /settings/i }))
    const slider = screen.getByTestId('slider-fog')
    fireEvent.change(slider, { target: { value: '0.00002' } })
    expect(onFog).toHaveBeenCalledWith(0.00002)
  })

  it('calls onFovChange when fov slider changes', () => {
    const onFov = vi.fn()
    render(<SettingsPanel onFovChange={onFov} />)
    fireEvent.click(screen.getByRole('button', { name: /settings/i }))
    const slider = screen.getByTestId('slider-fov')
    fireEvent.change(slider, { target: { value: '75' } })
    expect(onFov).toHaveBeenCalledWith(75)
  })

  it('calls onMouseSensitivityChange when sensitivity slider changes', () => {
    const onSens = vi.fn()
    render(<SettingsPanel onMouseSensitivityChange={onSens} />)
    fireEvent.click(screen.getByRole('button', { name: /settings/i }))
    const slider = screen.getByTestId('slider-sensitivity')
    fireEvent.change(slider, { target: { value: '0.003' } })
    expect(onSens).toHaveBeenCalledWith(0.003)
  })

  it('calls onWorldConfigApply when world config is applied', () => {
    const onApply = vi.fn()
    render(<SettingsPanel onWorldConfigApply={onApply} />)
    fireEvent.click(screen.getByRole('button', { name: /settings/i }))
    fireEvent.change(screen.getByTestId('input-world-seed'), { target: { value: '1234' } })
    fireEvent.change(screen.getByTestId('input-biome-scale'), { target: { value: '2.5' } })
    fireEvent.click(screen.getByRole('button', { name: /apply world config/i }))
    expect(onApply).toHaveBeenCalledWith({ seed: 1234, biomeScale: 2.5 })
  })

  it('saves value to localStorage on slider change', () => {
    render(<SettingsPanel />)
    fireEvent.click(screen.getByRole('button', { name: /settings/i }))
    fireEvent.change(screen.getByTestId('slider-fov'), { target: { value: '80' } })
    expect(localStorageMock.setItem).toHaveBeenCalledWith('terrain_fov', '80')
  })

  it('resets all sliders to defaults on Reset click', () => {
    const onFog = vi.fn()
    const onFov = vi.fn()
    const onSens = vi.fn()
    render(
      <SettingsPanel
        onFogDensityChange={onFog}
        onFovChange={onFov}
        onMouseSensitivityChange={onSens}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /settings/i }))
    fireEvent.click(screen.getByRole('button', { name: /reset/i }))
    expect(onFog).toHaveBeenLastCalledWith(0.000008)
    expect(onFov).toHaveBeenLastCalledWith(60)
    expect(onSens).toHaveBeenLastCalledWith(0.002)
  })
})
