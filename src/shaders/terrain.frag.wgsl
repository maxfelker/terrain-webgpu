struct Uniforms {
  viewProj:    mat4x4<f32>,
  worldOffset: vec4<f32>,
  cameraPos:   vec4<f32>,
  fogParams:   vec4<f32>,
}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@group(1) @binding(0) var terrainSampler: sampler;
@group(1) @binding(1) var grassTex: texture_2d<f32>;
@group(1) @binding(2) var rockTex:  texture_2d<f32>;

struct FragInput {
  @location(0) normal:   vec3<f32>,
  @location(1) uv:       vec2<f32>,
  @location(2) worldPos: vec3<f32>,
}

@fragment
fn fs_main(f: FragInput) -> @location(0) vec4<f32> {
  let grassColor = textureSample(grassTex, terrainSampler, f.uv * 8.0).rgb;
  let rockColor  = textureSample(rockTex,  terrainSampler, f.uv * 6.0).rgb;

  let slope  = clamp(f.normal.y, 0.0, 1.0);
  let blend  = smoothstep(0.55, 0.80, slope);
  let albedo = mix(rockColor, grassColor, blend);

  let lightDir = normalize(vec3<f32>(0.5, 1.2, 0.4));
  let diffuse  = max(dot(normalize(f.normal), lightDir), 0.0);
  let lit      = albedo * (0.2 + diffuse * 0.8);

  let fogDensity = uniforms.fogParams.x;
  let fragDist   = length(f.worldPos - uniforms.cameraPos.xyz);
  let fogFactor  = clamp(exp(-fogDensity * fragDist * fragDist), 0.0, 1.0);
  let skyColor   = vec3<f32>(0.53, 0.81, 0.98);
  let finalColor = mix(skyColor, lit, fogFactor);

  return vec4<f32>(finalColor, 1.0);
}
