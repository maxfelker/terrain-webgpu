import terrainVert from '../shaders/terrain.vert.wgsl?raw'
import terrainFrag from '../shaders/terrain.frag.wgsl?raw'

export interface TerrainPipeline {
  pipeline: GPURenderPipeline
  bindGroupLayout: GPUBindGroupLayout
}

function createTerrainPipeline(device: GPUDevice, format: GPUTextureFormat): TerrainPipeline {
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [{
      binding: 0,
      visibility: GPUShaderStage.VERTEX,
      buffer: { type: 'uniform' },
    }],
  })

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  })

  const vertModule = device.createShaderModule({ code: terrainVert })
  const fragModule = device.createShaderModule({ code: terrainFrag })

  const pipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
      module: vertModule,
      entryPoint: 'vs_main',
      buffers: [{
        arrayStride: 32,  // 8 floats × 4 bytes
        attributes: [
          { shaderLocation: 0, offset: 0,  format: 'float32x3' },
          { shaderLocation: 1, offset: 12, format: 'float32x3' },
          { shaderLocation: 2, offset: 24, format: 'float32x2' },
        ],
      }],
    },
    fragment: {
      module: fragModule,
      entryPoint: 'fs_main',
      targets: [{ format }],
    },
    primitive: { topology: 'triangle-list' },
    depthStencil: {
      format: 'depth24plus',
      depthWriteEnabled: true,
      depthCompare: 'less',
    },
  })

  return { pipeline, bindGroupLayout }
}

export default createTerrainPipeline
