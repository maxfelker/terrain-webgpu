import { useState } from 'react'
import { save, load, DEFAULTS } from '../../engine/Settings'
import styles from './Settings.module.css'

interface SettingsPanelProps {
  onFogDensityChange?: (v: number) => void
  onFovChange?: (v: number) => void
  onMouseSensitivityChange?: (v: number) => void
}

export default function SettingsPanel({
  onFogDensityChange,
  onFovChange,
  onMouseSensitivityChange,
}: SettingsPanelProps) {
  const [open, setOpen] = useState(false)
  const [fogDensity, setFogDensity] = useState(() => load('fogDensity'))
  const [fov, setFov] = useState(() => load('fov'))
  const [sensitivity, setSensitivity] = useState(() => load('mouseSensitivity'))

  function handleFogDensity(v: number) {
    setFogDensity(v)
    save('fogDensity', v)
    onFogDensityChange?.(v)
  }

  function handleFov(v: number) {
    setFov(v)
    save('fov', v)
    onFovChange?.(v)
  }

  function handleSensitivity(v: number) {
    setSensitivity(v)
    save('mouseSensitivity', v)
    onMouseSensitivityChange?.(v)
  }

  function handleReset() {
    handleFogDensity(DEFAULTS.fogDensity)
    handleFov(DEFAULTS.fov)
    handleSensitivity(DEFAULTS.mouseSensitivity)
  }

  return (
    <div className={styles.container}>
      <button
        className={styles.toggle}
        onClick={() => setOpen(o => !o)}
        aria-label="Settings"
        title="Settings"
      >
        ⚙
      </button>
      {open && (
        <div className={styles.panel} data-testid="settings-panel">
          <h4 className={styles.title}>Settings</h4>

          <label className={styles.label}>
            Fog Density
            <input
              type="range"
              min={0}
              max={0.00005}
              step={0.000001}
              value={fogDensity}
              onChange={e => handleFogDensity(parseFloat(e.target.value))}
              className={styles.slider}
              data-testid="slider-fog"
            />
            <span className={styles.value}>{fogDensity.toExponential(2)}</span>
          </label>

          <label className={styles.label}>
            FOV
            <input
              type="range"
              min={40}
              max={100}
              step={1}
              value={fov}
              onChange={e => handleFov(parseFloat(e.target.value))}
              className={styles.slider}
              data-testid="slider-fov"
            />
            <span className={styles.value}>{fov}°</span>
          </label>

          <label className={styles.label}>
            Mouse Sensitivity
            <input
              type="range"
              min={0.0005}
              max={0.005}
              step={0.0001}
              value={sensitivity}
              onChange={e => handleSensitivity(parseFloat(e.target.value))}
              className={styles.slider}
              data-testid="slider-sensitivity"
            />
            <span className={styles.value}>{sensitivity.toFixed(4)}</span>
          </label>

          <button className={styles.reset} onClick={handleReset}>Reset</button>
        </div>
      )}
    </div>
  )
}
