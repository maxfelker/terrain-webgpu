// Manages GPU textures for terrain rendering.
// Generates procedural grass and rock textures at construction time.
export default class TextureManager {
  private grassTexture: GPUTexture
  private rockTexture: GPUTexture
  private sampler: GPUSampler
  readonly bindGroupLayout: GPUBindGroupLayout
  readonly bindGroup: GPUBindGroup

  constructor(device: GPUDevice) {
    this.grassTexture = generateGrassTexture(device)
    this.rockTexture = generateRockTexture(device)

    this.sampler = device.createSampler({
      minFilter: 'linear',
      magFilter: 'linear',
      addressModeU: 'repeat',
      addressModeV: 'repeat',
    })

    this.bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      ],
    })

    this.bindGroup = device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: this.grassTexture.createView() },
        { binding: 2, resource: this.rockTexture.createView() },
      ],
    })
  }
}

function createProceduralTexture(
  device: GPUDevice,
  baseR: number,
  baseG: number,
  baseB: number,
): GPUTexture {
  const SIZE = 256
  const data = new Uint8Array(SIZE * SIZE * 4)
  for (let i = 0; i < SIZE * SIZE; i++) {
    const vary = () => Math.floor((Math.random() * 0.3 - 0.15) * 255)
    data[i * 4 + 0] = Math.min(255, Math.max(0, baseR + vary()))
    data[i * 4 + 1] = Math.min(255, Math.max(0, baseG + vary()))
    data[i * 4 + 2] = Math.min(255, Math.max(0, baseB + vary()))
    data[i * 4 + 3] = 255
  }

  const texture = device.createTexture({
    size: [SIZE, SIZE, 1],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    mipLevelCount: 1,
  })

  device.queue.writeTexture(
    { texture, mipLevel: 0 },
    data,
    { bytesPerRow: SIZE * 4, rowsPerImage: SIZE },
    [SIZE, SIZE, 1],
  )

  return texture
}

function generateGrassTexture(device: GPUDevice): GPUTexture {
  return createProceduralTexture(device, 50, 140, 30)
}

function generateRockTexture(device: GPUDevice): GPUTexture {
  return createProceduralTexture(device, 115, 95, 75)
}
