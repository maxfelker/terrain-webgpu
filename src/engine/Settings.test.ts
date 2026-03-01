import { describe, it, expect, beforeEach, vi } from 'vitest'
import { save, load, DEFAULTS } from './Settings'

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

describe('Settings.save / load', () => {
  it('returns default value when nothing saved', () => {
    expect(load('fogDensity')).toBe(DEFAULTS.fogDensity)
    expect(load('fov')).toBe(DEFAULTS.fov)
    expect(load('mouseSensitivity')).toBe(DEFAULTS.mouseSensitivity)
  })

  it('persists and loads fogDensity', () => {
    save('fogDensity', 0.00002)
    expect(load('fogDensity')).toBeCloseTo(0.00002)
  })

  it('persists and loads fov', () => {
    save('fov', 75)
    expect(load('fov')).toBe(75)
  })

  it('persists and loads mouseSensitivity', () => {
    save('mouseSensitivity', 0.003)
    expect(load('mouseSensitivity')).toBeCloseTo(0.003)
  })

  it('uses provided defaultVal when nothing saved', () => {
    expect(load('fov', 90)).toBe(90)
  })

  it('returns saved value over provided defaultVal', () => {
    save('fov', 55)
    expect(load('fov', 90)).toBe(55)
  })

  it('handles localStorage throwing gracefully on save', () => {
    localStorageMock.setItem.mockImplementationOnce(() => { throw new Error('quota') })
    expect(() => save('fov', 70)).not.toThrow()
  })

  it('handles localStorage throwing gracefully on load', () => {
    localStorageMock.getItem.mockImplementationOnce(() => { throw new Error('denied') })
    expect(load('fov')).toBe(DEFAULTS.fov)
  })
})
