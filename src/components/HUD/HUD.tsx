import type { PlayerState } from '../../engine/FPSCamera'
import styles from './HUD.module.css'

interface Props {
  playerState: PlayerState | null
  fps: number
}

export default function HUD({ playerState, fps }: Props) {
  return (
    <div className={styles.hud}>
      <div className={styles.crosshair}>+</div>
      <div className={styles.info}>
        {playerState && (
          <>
            <div>X: {playerState.x.toFixed(1)} Y: {playerState.y.toFixed(1)} Z: {playerState.z.toFixed(1)}</div>
            <div>Stamina: {playerState.stamina.toFixed(1)}</div>
            <div>{playerState.grounded ? 'GROUNDED' : 'AIRBORNE'}</div>
          </>
        )}
        <div>FPS: {fps}</div>
      </div>
      <div className={styles.hint}>Click to capture mouse | ESC to release</div>
    </div>
  )
}
