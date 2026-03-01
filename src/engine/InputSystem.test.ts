import { describe, it, expect, beforeEach } from 'vitest'
import InputSystem from './InputSystem'

describe('InputSystem', () => {
  let input: InputSystem

  beforeEach(() => {
    input = new InputSystem()
  })

  it('flush returns false for all keys when no keys pressed', () => {
    const snap = input.flush()
    expect(snap.forward).toBe(false)
    expect(snap.backward).toBe(false)
    expect(snap.left).toBe(false)
    expect(snap.right).toBe(false)
    expect(snap.jump).toBe(false)
    expect(snap.sprint).toBe(false)
    expect(snap.mouseDX).toBe(0)
    expect(snap.mouseDY).toBe(0)
  })

  it('flush resets mouse deltas to zero after read', () => {
    // @ts-expect-error - access private for test
    input.mouseDX = 10
    // @ts-expect-error - access private for test
    input.mouseDY = 5
    const first = input.flush()
    expect(first.mouseDX).toBe(10)
    expect(first.mouseDY).toBe(5)
    const second = input.flush()
    expect(second.mouseDX).toBe(0)
    expect(second.mouseDY).toBe(0)
  })

  it('maps W key to forward', () => {
    // @ts-expect-error - access private for test
    input.keys.add('KeyW')
    const snap = input.flush()
    expect(snap.forward).toBe(true)
    expect(snap.backward).toBe(false)
  })

  it('maps S key to backward', () => {
    // @ts-expect-error - access private for test
    input.keys.add('KeyS')
    const snap = input.flush()
    expect(snap.backward).toBe(true)
  })

  it('maps Space to jump', () => {
    // @ts-expect-error - access private for test
    input.keys.add('Space')
    const snap = input.flush()
    expect(snap.jump).toBe(true)
  })

  it('maps ShiftLeft to sprint', () => {
    // @ts-expect-error - access private for test
    input.keys.add('ShiftLeft')
    const snap = input.flush()
    expect(snap.sprint).toBe(true)
  })
})
