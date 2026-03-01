import { useRef, useState } from 'react'
import styles from './TextureUploader.module.css'

interface Props {
  onTextureLoad: (slot: 'grass' | 'rock', bitmap: ImageBitmap) => void
}

interface SlotState {
  preview: string | null
  dragOver: boolean
}

function TextureSlot({
  label,
  slot,
  state,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange,
}: {
  label: string
  slot: 'grass' | 'rock'
  state: SlotState
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      className={`${styles.slot} ${state.dragOver ? styles.dragOver : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label={`Upload ${label} texture`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        className={styles.fileInput}
        data-slot={slot}
        onChange={onFileChange}
        aria-label={`${label} texture file input`}
      />
      {state.preview ? (
        <img src={state.preview} alt={`${label} preview`} className={styles.preview} />
      ) : (
        <span className={styles.slotLabel}>{label}</span>
      )}
    </div>
  )
}

export default function TextureUploader({ onTextureLoad }: Props) {
  const [grass, setGrass] = useState<SlotState>({ preview: null, dragOver: false })
  const [rock, setRock] = useState<SlotState>({ preview: null, dragOver: false })

  function getSetState(slot: 'grass' | 'rock') {
    return slot === 'grass' ? setGrass : setRock
  }

  async function handleFile(slot: 'grass' | 'rock', file: File) {
    const bitmap = await createImageBitmap(file)
    const preview = URL.createObjectURL(file)
    getSetState(slot)(s => ({ ...s, preview }))
    onTextureLoad(slot, bitmap)
  }

  function makeHandlers(slot: 'grass' | 'rock') {
    const setState = getSetState(slot)
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault()
        setState(s => ({ ...s, dragOver: true }))
      },
      onDragLeave: () => setState(s => ({ ...s, dragOver: false })),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault()
        setState(s => ({ ...s, dragOver: false }))
        const file = e.dataTransfer.files[0]
        if (file) handleFile(slot, file)
      },
      onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) handleFile(slot, file)
      },
    }
  }

  const grassHandlers = makeHandlers('grass')
  const rockHandlers = makeHandlers('rock')

  return (
    <div className={styles.panel}>
      <div className={styles.title}>Textures</div>
      <TextureSlot label="Grass" slot="grass" state={grass} {...grassHandlers} />
      <TextureSlot label="Rock" slot="rock" state={rock} {...rockHandlers} />
    </div>
  )
}
