import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import TextureUploader from './TextureUploader'

// Mock createImageBitmap globally
beforeAll(() => {
  globalThis.createImageBitmap = vi.fn().mockResolvedValue({ width: 64, height: 64 } as ImageBitmap)
  globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
})

function makeFile(name = 'tex.png') {
  return new File(['data'], name, { type: 'image/png' })
}

describe('TextureUploader', () => {
  it('renders without crashing', () => {
    const { getByText } = render(<TextureUploader onTextureLoad={vi.fn()} />)
    expect(getByText('Grass')).toBeTruthy()
    expect(getByText('Rock')).toBeTruthy()
  })

  it('calls onTextureLoad with grass slot on grass file input change', async () => {
    const onTextureLoad = vi.fn()
    const { getAllByLabelText } = render(<TextureUploader onTextureLoad={onTextureLoad} />)

    const inputs = getAllByLabelText(/texture file input/i)
    const grassInput = inputs.find(el => (el as HTMLInputElement).dataset.slot === 'grass')!

    fireEvent.change(grassInput, { target: { files: [makeFile('grass.png')] } })

    await waitFor(() => {
      expect(onTextureLoad).toHaveBeenCalledWith('grass', expect.objectContaining({ width: 64, height: 64 }))
    })
  })

  it('calls onTextureLoad with rock slot on rock file input change', async () => {
    const onTextureLoad = vi.fn()
    const { getAllByLabelText } = render(<TextureUploader onTextureLoad={onTextureLoad} />)

    const inputs = getAllByLabelText(/texture file input/i)
    const rockInput = inputs.find(el => (el as HTMLInputElement).dataset.slot === 'rock')!

    fireEvent.change(rockInput, { target: { files: [makeFile('rock.png')] } })

    await waitFor(() => {
      expect(onTextureLoad).toHaveBeenCalledWith('rock', expect.objectContaining({ width: 64, height: 64 }))
    })
  })

  it('calls onTextureLoad on drop into grass zone', async () => {
    const onTextureLoad = vi.fn()
    const { getAllByRole } = render(<TextureUploader onTextureLoad={onTextureLoad} />)

    const zones = getAllByRole('button')
    const grassZone = zones[0]

    const file = makeFile('dropped.png')
    fireEvent.dragOver(grassZone, { preventDefault: vi.fn() })
    fireEvent.drop(grassZone, {
      dataTransfer: { files: [file] },
      preventDefault: vi.fn(),
    })

    await waitFor(() => {
      expect(onTextureLoad).toHaveBeenCalledWith('grass', expect.objectContaining({ width: 64, height: 64 }))
    })
  })

  it('calls onTextureLoad on drop into rock zone', async () => {
    const onTextureLoad = vi.fn()
    const { getAllByRole } = render(<TextureUploader onTextureLoad={onTextureLoad} />)

    const zones = getAllByRole('button')
    const rockZone = zones[1]

    const file = makeFile('dropped-rock.png')
    fireEvent.dragOver(rockZone, { preventDefault: vi.fn() })
    fireEvent.drop(rockZone, {
      dataTransfer: { files: [file] },
      preventDefault: vi.fn(),
    })

    await waitFor(() => {
      expect(onTextureLoad).toHaveBeenCalledWith('rock', expect.objectContaining({ width: 64, height: 64 }))
    })
  })
})
