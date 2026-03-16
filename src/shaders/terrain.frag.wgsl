struct Uniforms {
  viewProj:    mat4x4<f32>,
  worldOffset: vec4<f32>,
  cameraPos:   vec4<f32>,
  fogParams:   vec4<f32>,
  _pad:        vec4<f32>,
  biomeData:   vec4<f32>,
}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct FragInput {
  @location(0) normal:   vec3<f32>,
  @location(1) uv:       vec2<f32>,
  @location(2) worldPos: vec3<f32>,
}

fn getBiomeColor(id: f32) -> vec3f {
    let biome = i32(round(id));
    if (biome == 1) { return vec3f(0.86, 0.76, 0.42); } // Desert
    if (biome == 2) { return vec3f(0.55, 0.50, 0.45); } // Mountains
    if (biome == 3) { return vec3f(0.42, 0.60, 0.24); } // Valley
    if (biome == 4) { return vec3f(0.22, 0.28, 0.14); } // Swamp
    if (biome == 5) { return vec3f(0.20, 0.40, 0.12); } // Forest
    return vec3f(0.34, 0.52, 0.18); // Grassland (default)
}

fn getHeightBlendedColor(biomeId: f32, worldY: f32) -> vec3f {
    let baseColor = getBiomeColor(biomeId);
    let rockColor = vec3f(0.52, 0.48, 0.44);
    let snowColor = vec3f(0.92, 0.93, 0.95);

    // Blend toward rock at mid-heights (>= 60 world units)
    let rockBlend = clamp((worldY - 60.0) / 120.0, 0.0, 1.0);
    let midColor = mix(baseColor, rockColor, rockBlend);

    // Blend toward snow at very high elevations (>= 300 world units)
    let snowBlend = clamp((worldY - 300.0) / 150.0, 0.0, 1.0);
    return mix(midColor, snowColor, snowBlend);
}

fn getTransitionBlendedColor(primaryBiomeId: f32, secondaryBiomeId: f32, blendFactor: f32, worldY: f32) -> vec3f {
    let primaryColor = getHeightBlendedColor(primaryBiomeId, worldY);
    let secondaryColor = getHeightBlendedColor(secondaryBiomeId, worldY);
    return mix(primaryColor, secondaryColor, clamp(blendFactor, 0.0, 1.0));
}

@fragment
fn fs_main(f: FragInput) -> @location(0) vec4<f32> {
  let albedo = getTransitionBlendedColor(
    uniforms.biomeData.x,
    uniforms.biomeData.y,
    uniforms.biomeData.z,
    f.worldPos.y,
  );

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
