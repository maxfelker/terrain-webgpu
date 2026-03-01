struct Uniforms {
  viewProj: mat4x4<f32>,
  worldOffset: vec4<f32>,
}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
}

struct VertexOutput {
  @builtin(position) clip: vec4<f32>,
  @location(0) normal: vec3<f32>,
  @location(1) uv: vec2<f32>,
}

@vertex
fn vs_main(v: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  let worldPos = vec4<f32>(v.position + uniforms.worldOffset.xyz, 1.0);
  out.clip = uniforms.viewProj * worldPos;
  out.normal = v.normal;
  out.uv = v.uv;
  return out;
}
