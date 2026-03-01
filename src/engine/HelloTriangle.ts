const SHADER = /* wgsl */`
  @vertex
  fn vs_main(@builtin(vertex_index) idx: u32) -> @builtin(position) vec4f {
    var pos = array<vec2f, 3>(
      vec2f( 0.0,  0.5),
      vec2f(-0.5, -0.5),
      vec2f( 0.5, -0.5),
    );
    return vec4f(pos[idx], 0.0, 1.0);
  }

  @fragment
  fn fs_main() -> @location(0) vec4f {
    return vec4f(0.2, 0.8, 0.4, 1.0);
  }
`

function createPipeline(device: GPUDevice, format: GPUTextureFormat): GPURenderPipeline {
  const shader = device.createShaderModule({ label: 'hello-triangle', code: SHADER })
  return device.createRenderPipeline({
    label: 'hello-triangle-pipeline',
    layout: 'auto',
    vertex: { module: shader, entryPoint: 'vs_main' },
    fragment: { module: shader, entryPoint: 'fs_main', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
  })
}

function frame(device: GPUDevice, context: GPUCanvasContext, pipeline: GPURenderPipeline) {
  const encoder = device.createCommandEncoder()
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      clearValue: { r: 0.05, g: 0.05, b: 0.1, a: 1.0 },
      loadOp: 'clear',
      storeOp: 'store',
    }],
  })
  pass.setPipeline(pipeline)
  pass.draw(3)
  pass.end()
  device.queue.submit([encoder.finish()])
  requestAnimationFrame(() => frame(device, context, pipeline))
}

export default async function renderHelloTriangle(
  device: GPUDevice,
  context: GPUCanvasContext,
  format: GPUTextureFormat,
): Promise<void> {
  const pipeline = createPipeline(device, format)
  requestAnimationFrame(() => frame(device, context, pipeline))
}
