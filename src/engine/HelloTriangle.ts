export async function renderHelloTriangle(
  device: GPUDevice,
  context: GPUCanvasContext,
  format: GPUTextureFormat
): Promise<void> {
  const shader = device.createShaderModule({
    label: 'hello-triangle',
    code: `
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
    `,
  })

  const pipeline = device.createRenderPipeline({
    label: 'hello-triangle-pipeline',
    layout: 'auto',
    vertex: { module: shader, entryPoint: 'vs_main' },
    fragment: {
      module: shader,
      entryPoint: 'fs_main',
      targets: [{ format }],
    },
    primitive: { topology: 'triangle-list' },
  })

  function frame() {
    const commandEncoder = device.createCommandEncoder()
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.05, g: 0.05, b: 0.1, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    })
    renderPass.setPipeline(pipeline)
    renderPass.draw(3)
    renderPass.end()
    device.queue.submit([commandEncoder.finish()])
    requestAnimationFrame(frame)
  }

  requestAnimationFrame(frame)
}
