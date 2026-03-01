struct FragInput {
  @location(0) normal: vec3<f32>,
  @location(1) uv: vec2<f32>,
}

@fragment
fn fs_main(f: FragInput) -> @location(0) vec4<f32> {
  let light = max(dot(normalize(f.normal), vec3<f32>(0.4, 1.0, 0.3)), 0.1);
  let grass = vec3<f32>(0.25, 0.55, 0.15);
  let rock  = vec3<f32>(0.45, 0.38, 0.28);
  let blend = smoothstep(0.6, 0.85, f.normal.y);
  let color = mix(rock, grass, blend) * light;
  return vec4<f32>(color, 1.0);
}
