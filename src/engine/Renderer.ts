export default class Renderer {
  private device: GPUDevice
  private context: GPUCanvasContext
  private depthTexture: GPUTexture

  constructor(device: GPUDevice, context: GPUCanvasContext, format: GPUTextureFormat) {
    this.device = device
    this.context = context
    void format
    const canvas = context.canvas as HTMLCanvasElement
    this.depthTexture = this.createDepthTexture(canvas.width, canvas.height)
  }

  private createDepthTexture(width: number, height: number): GPUTexture {
    return this.device.createTexture({
      size: [width, height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    })
  }

  resize(width: number, height: number): void {
    this.depthTexture.destroy()
    this.depthTexture = this.createDepthTexture(width, height)
  }

  beginFrame(): { encoder: GPUCommandEncoder; pass: GPURenderPassEncoder } {
    const encoder = this.device.createCommandEncoder()
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0.53, g: 0.81, b: 0.98, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    })
    return { encoder, pass }
  }

  drawChunk(
    pass: GPURenderPassEncoder,
    pipeline: GPURenderPipeline,
    uniformBindGroup: GPUBindGroup,
    textureBindGroup: GPUBindGroup,
    vertexBuffer: GPUBuffer,
    indexBuffer: GPUBuffer,
    indexCount: number,
  ): void {
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, uniformBindGroup)
    pass.setBindGroup(1, textureBindGroup)
    pass.setVertexBuffer(0, vertexBuffer)
    pass.setIndexBuffer(indexBuffer, 'uint32')
    pass.drawIndexed(indexCount)
  }

  endFrame(encoder: GPUCommandEncoder, pass: GPURenderPassEncoder): void {
    pass.end()
    this.device.queue.submit([encoder.finish()])
  }
}
