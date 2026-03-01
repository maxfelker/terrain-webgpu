import { describe, it, expect, beforeAll } from 'vitest'
import TextureManager from './TextureManager'

// WebGPU flag constants are not available in the test environment (happy-dom).
// Define the minimum set needed by TextureManager.
beforeAll(() => {
  if (typeof GPUTextureUsage === 'undefined') {
    Object.defineProperty(globalThis, 'GPUTextureUsage', {
      value: { TEXTURE_BINDING: 4, COPY_DST: 8, RENDER_ATTACHMENT: 16 },
    })
  }
  if (typeof GPUShaderStage === 'undefined') {
    Object.defineProperty(globalThis, 'GPUShaderStage', {
      value: { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 },
    })
  }
})

function makeFakeDevice(): { device: GPUDevice; calls: string[] } {
  const calls: string[] = []

  const fakeDevice = {
    createTexture: (_desc: GPUTextureDescriptor) => {
      calls.push('createTexture')
      return { createView: () => ({}), destroy: () => {} } as unknown as GPUTexture
    },
    createSampler: (_desc?: GPUSamplerDescriptor) => {
      calls.push('createSampler')
      return {} as GPUSampler
    },
    createBindGroupLayout: (desc: GPUBindGroupLayoutDescriptor) => {
      calls.push('bindGroupLayout')
      return { entries: desc.entries } as unknown as GPUBindGroupLayout
    },
    createBindGroup: (_desc: GPUBindGroupDescriptor) => {
      calls.push('createBindGroup')
      return {} as GPUBindGroup
    },
    queue: {
      writeTexture: () => { calls.push('writeTexture') },
    },
  } as unknown as GPUDevice

  return { device: fakeDevice, calls }
}

describe('TextureManager', () => {
  it('creates grass and rock textures without throwing', () => {
    const { device } = makeFakeDevice()
    expect(() => new TextureManager(device)).not.toThrow()
  })

  it('bindGroupLayout has 3 entries', () => {
    const { device } = makeFakeDevice()
    const tm = new TextureManager(device)
    const layout = tm.bindGroupLayout as unknown as { entries: GPUBindGroupLayoutEntry[] }
    expect(layout.entries).toHaveLength(3)
  })

  it('creates exactly 2 textures and writes to them', () => {
    const { device, calls } = makeFakeDevice()
    new TextureManager(device)
    expect(calls.filter(c => c === 'createTexture')).toHaveLength(2)
    expect(calls.filter(c => c === 'writeTexture')).toHaveLength(2)
  })
})

function makeFakeDeviceWithExternal(): { device: GPUDevice; calls: string[] } {
  const calls: string[] = []

  const fakeDevice = {
    createTexture: (_desc: GPUTextureDescriptor) => {
      calls.push('createTexture')
      return { createView: () => ({}), destroy: () => { calls.push('destroyTexture') } } as unknown as GPUTexture
    },
    createSampler: (_desc?: GPUSamplerDescriptor) => {
      calls.push('createSampler')
      return {} as GPUSampler
    },
    createBindGroupLayout: (desc: GPUBindGroupLayoutDescriptor) => {
      calls.push('bindGroupLayout')
      return { entries: desc.entries } as unknown as GPUBindGroupLayout
    },
    createBindGroup: (_desc: GPUBindGroupDescriptor) => {
      calls.push('createBindGroup')
      return {} as GPUBindGroup
    },
    queue: {
      writeTexture: () => { calls.push('writeTexture') },
      copyExternalImageToTexture: () => { calls.push('copyExternalImageToTexture') },
    },
  } as unknown as GPUDevice

  return { device: fakeDevice, calls }
}

describe('TextureManager.updateTexture', () => {
  it('replaces the bind group after updateTexture (grass slot)', () => {
    const { device, calls } = makeFakeDeviceWithExternal()
    const tm = new TextureManager(device)

    const bindGroupCallsBefore = calls.filter(c => c === 'createBindGroup').length
    const bitmap = { width: 64, height: 64 } as ImageBitmap

    tm.updateTexture(device, 'grass', bitmap)

    expect(calls.filter(c => c === 'createBindGroup').length).toBe(bindGroupCallsBefore + 1)
    expect(calls).toContain('copyExternalImageToTexture')
    expect(calls).toContain('destroyTexture')
  })

  it('replaces the bind group after updateTexture (rock slot)', () => {
    const { device, calls } = makeFakeDeviceWithExternal()
    const tm = new TextureManager(device)

    const bindGroupCallsBefore = calls.filter(c => c === 'createBindGroup').length
    const bitmap = { width: 128, height: 128 } as ImageBitmap

    tm.updateTexture(device, 'rock', bitmap)

    expect(calls.filter(c => c === 'createBindGroup').length).toBe(bindGroupCallsBefore + 1)
    expect(calls).toContain('copyExternalImageToTexture')
    expect(calls).toContain('destroyTexture')
  })
})
