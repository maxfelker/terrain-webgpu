// Simple localStorage-backed settings persistence.
export const DEFAULTS = {
  fogDensity: 0.000008,
  fov: 60,
  mouseSensitivity: 0.002,
} as const

export type SettingKey = keyof typeof DEFAULTS

export function save(key: SettingKey, value: number): void {
  try {
    localStorage.setItem(`terrain_${key}`, String(value))
  } catch {
    // localStorage may be unavailable (e.g. in tests)
  }
}

export function load(key: SettingKey, defaultVal?: number): number {
  try {
    const raw = localStorage.getItem(`terrain_${key}`)
    if (raw !== null) {
      const parsed = parseFloat(raw)
      if (!isNaN(parsed)) return parsed
    }
  } catch {
    // localStorage may be unavailable
  }
  return defaultVal ?? DEFAULTS[key]
}
