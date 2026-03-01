# terrain-webgpu — Technical Architecture & Implementation Plan

> Web-native, first-person procedural terrain explorer built with **React 19 + Vite 6**, **Go 1.25 → WASM**, and **WebGPU**.
> Primary reference: [`terra-major-unity`](../terra-major-unity) (updated implementation). Earlier reference: [`terrain-generator-unity3d`](../terrain-generator-unity3d) (original implementation).
> **Physics, world management, and chunk determination all run in Go WASM. TypeScript is a thin rendering and input bridge only.**

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Source Reference Analysis](#2-source-reference-analysis)
3. [Technical Architecture](#3-technical-architecture)
   - 3.1 [Stack Overview](#31-stack-overview)
   - 3.2 [Layer Diagram](#32-layer-diagram)
   - 3.3 [Layer 1 — App Shell (React 19 + Vite 6 + TypeScript)](#33-layer-1--app-shell-react-19--vite-6--typescript)
   - 3.4 [Layer 2 — Go WASM Engine (Noise + Physics + World)](#34-layer-2--go-wasm-engine-noise--physics--world)
   - 3.5 [WASM Physics Engine Design](#35-wasm-physics-engine-design)
   - 3.6 [WASM World Management Design](#36-wasm-world-management-design)
   - 3.7 [Layer 3 — WebGPU Renderer](#37-layer-3--webgpu-renderer)
   - 3.8 [Layer 4 — First-Person Input Bridge](#38-layer-4--first-person-input-bridge)
   - 3.9 [Layer 5 — Texture & Image System](#39-layer-5--texture--image-system)
   - 3.10 [Data Flow](#310-data-flow)
4. [Directory Structure](#4-directory-structure)
5. [Key Data Structures](#5-key-data-structures)
6. [Implementation Guide — Milestone Pull Requests](#6-implementation-guide--milestone-pull-requests)
   - [M1 — Project Scaffold](#m1--project-scaffold)
   - [M2 — Go WASM Noise + World Engine](#m2--go-wasm-noise--world-engine)
   - [M3 — Heightmap → Mesh Builder](#m3--heightmap--mesh-builder)
   - [M4 — WebGPU Terrain Renderer](#m4--webgpu-terrain-renderer)
   - [M5 — First-Person Input Bridge](#m5--first-person-input-bridge)
   - [M6 — WASM Physics Engine](#m6--wasm-physics-engine)
   - [M7 — WASM World Management + Chunk Streaming](#m7--wasm-world-management--chunk-streaming)
   - [M8 — Texture & Image Upload System](#m8--texture--image-upload-system)
   - [M9 — Polish, Performance & Packaging](#m9--polish-performance--packaging)
7. [WebGPU Shader Architecture](#7-webgpu-shader-architecture)
8. [Go WASM API Contract](#8-go-wasm-api-contract)
9. [Performance Targets](#9-performance-targets)
10. [Browser Compatibility & Fallbacks](#10-browser-compatibility--fallbacks)

---

## 1. Project Overview

`terrain-webgpu` is a browser-native re-implementation of the procedural terrain system from the Unity projects. The goals are:

| Goal | Description |
|---|---|
| **Procedural terrain** | Multi-octave FBm Simplex/Perlin noise (terra-major approach), seeded and parameterized entirely in Go WASM |
| **Infinite chunked world** | Chunks loaded/unloaded dynamically; world size and chunk determination computed in Go WASM |
| **WebGPU rendering** | Hardware-accelerated mesh rendering with textures, splatmaps, fog |
| **First-person experience** | Walk, sprint, jump with mouse-look camera |
| **Capsule collision** | Player physics (gravity, collision, slope limiting, jump) run entirely in Go WASM |
| **Image & texture support** | Upload heightmaps, diffuse textures; splatmap blending by slope |
| **WASM as game engine** | Go WASM owns all game state: player position, velocity, chunk registry, world parameters |
| **TypeScript as thin bridge** | TS relays input to WASM, reads back state for WebGPU rendering, manages React UI |
| **React 19 + Vite 6 UI shell** | Settings panel, texture uploader, FPS counter, HUD overlay |

---

## 2. Source Reference Analysis

> **Reading order:** terra-major-unity is the **primary, updated reference**. terrain-generator-unity3d is the earlier, simpler implementation. Where they differ, prefer terra-major patterns.

### terra-major-unity (Primary Reference)

**Noise:** `TerrainChunk.GetHeight()` uses `Mathf.PerlinNoise(position.x * config.frequency, position.z * config.frequency)` as the base height function. The project also ships a full `SimplexNoiseGenerator` (multi-octave, persistence, amplitude, frequency, offset) and the `FastNoiseLite` library (OpenSimplex2, Cellular, Ridged, FBm, DomainWarp — 6 noise types, 5 fractal types). **We use the SimplexNoiseGenerator / FastNoiseLite approach as primary in Go WASM.**

**Chunk config** (locally generated in our implementation — **no API/HTTP**):
```
TerrainChunkConfig {
  id, sandboxId,
  position (Vector3),
  dimension,          // chunk XZ size in world units
  height,             // max terrain height
  detailResolution,
  resolutionPerPatch,
  heightmapResolution,
  alphamapResolution,
  seed, gain, octaves, frequency, lacunarity,
  heightmap (string, unused in our local-only approach)
}
```
> **Note:** terra-major fetches configs from a REST API and stores them server-side. We generate all chunk configs locally in Go WASM from a seed + terrain params. No HTTP calls are made.

**World system (from `World.cs` — our primary world reference):**
- `initialRenderRadius = 2048` — radius for first render burst
- `renderRadius = 512` — radius for subsequent streaming
- `distanceThreshold = 1100` — max distance before requesting new chunks
- Player position drives `CheckAndRequestNewChunks()` which iterates at `closestConfig.dimension` steps
- `TerrainUtility.AutoConnect()` stitches chunk seams

**First-Person Controller (from `PlayerController.cs` + `FirstPersonController.cs` — our physics reference):**
- `CharacterController` with `slopeLimit = 65°`
- `walkSpeed = 5`, `sprintSpeed = 10`
- `jumpHeight = 1`, `gravity = -19.62`
- `groundCheck` sphere at capsule bottom, `checkDistance = 0.4`
- `groundMask` = layers 6 and 9 (terrain layers)
- Yaw: body rotates on Y axis; Pitch: camera rotates on X axis (clamped –110° to +70°)
- Sprint stamina: 15s sprint duration, 5s recharge duration
- `MouseUtility.GetMouseDampening()` + `DampenedMovement()` for smooth look
- WebGL-aware: extra dampening applied for browser builds (`Application.platform == RuntimePlatform.WebGLPlayer`)
- `AttemptJump()`: velocity.y = `sqrt(jumpHeight * -2 * gravity)` ≈ 6.26 m/s

**Camera (from `FirstPersonCameraController.cs`):**
- Pitch range: `minY = -110°`, `maxY = 70°`
- Walk perspective: localPosition `(0, 0.9, 0.22)`, FOV 70°
- Sprint perspective: localPosition `(0, 0.9, 0.5)`, FOV 70° (tween over 0.2s)

**Animation:** Animator-driven IK (`PlayerIK`), walk/strafe/speed blend parameters — not applicable to web, but movement feel values carry over.

---

### terrain-generator-unity3d (Earlier Reference)

**Noise:** 3D LibNoise `Perlin` — frequency, lacunarity (2.0), persistence (0.5), 6 octaves. The `NoiseProvider` applies a skew rotation (`rotateXZBeforeY`) before evaluating to break visible grid alignment. Output scaled by `height` (1.5) and offset by `damper` (0.25). **We apply this skew technique in our Go noise implementation.**

**Chunks:**
- Chunk size: 100×100 world units, height: 40 units
- Heightmap resolution: 129×129 (power-of-two + 1)
- Generation radius: 4 chunks (circular test `x²+z²< r²`) — **we use this circular radius pattern in Go WASM**
- `ChunkCache` state machine: `RequestedChunks → ChunksBeingGenerated (max 3 goroutines) → LoadedChunks` — **ported directly to Go WASM**
- Neighbor stitching: each chunk tracks XUp/XDown/ZUp/ZDown references — **ported to Go WASM world package**

**Textures:** Two-layer splatmap — flat texture vs. steep texture, blended by `GetSteepness()` normalized to 0–1.5 slope angle. **Shader-driven in our WebGPU fragment shader.**

**Player:** Unity Standard Assets `FirstPersonController` (CharacterController, capsule shape) — superseded by terra-major's `PlayerController` as our reference.

---

## 3. Technical Architecture

### 3.1 Stack Overview

| Layer | Technology | Role |
|---|---|---|
| App shell | React 19 + Vite 6 + TypeScript | UI only: canvas, HUD, settings panel, texture upload |
| WASM engine | Go 1.25 → WASM (`syscall/js`) | **All game logic**: noise, heightmaps, physics, world management, chunk registry |
| Worker bridge | Web Worker API | Runs WASM off main thread; input in, game state + chunk data out |
| Renderer | WebGPU (WGSL shaders) | Terrain mesh, textures, splatmap, sky, fog — driven by WASM state |
| Player input | TypeScript + Pointer Lock API | Captures raw events; serializes to JSON; passes to WASM each frame |
| Texture system | ImageBitmap / GPUTexture | Diffuse maps, normal maps, heightmap image import via WASM |

> **Key principle:** TypeScript never computes physics, never determines chunk coordinates, never manages world state. It is a rendering and input relay. Go WASM is the authoritative game engine.

### 3.2 Layer Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                   React App Shell (UI only)                      │
│  Canvas  │  HUD Overlay  │  Settings Panel  │  Texture Upload   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ requestAnimationFrame (~16ms)
┌──────────────────────────▼──────────────────────────────────────┐
│              Game Loop (TypeScript — thin bridge only)           │
│  1. Serialize input events → postMessage to Worker              │
│  2. Receive WorldState from Worker (playerPos + chunk delta)    │
│  3. Upload new chunk GPU buffers if any                         │
│  4. Call Renderer.render(playerPos, activeChunks)               │
└──────┬──────────────────────────────────────────┬───────────────┘
       │ postMessage({ input, dt })                │ GPUDevice
┌──────▼───────────────────────────────────────┐  │
│  Web Worker                                   │  │
│  ┌────────────────────────────────────────┐  │  │
│  │         Go 1.25 WASM Engine            │  │  │
│  │                                        │  │  │
│  │  noise/      — SimplexNoise, FBm       │  │  │
│  │  terrain/    — heightmap, normals      │  │  │
│  │  physics/    — gravity, capsule,       │  │  │
│  │               ground check, slope,     │  │  │
│  │               jump, sprint stamina     │  │  │
│  │  world/      — chunk registry,         │  │  │
│  │               render radius,           │  │  │
│  │               distanceThreshold,       │  │  │
│  │               neighborhood stitching   │  │  │
│  └────────────────────────────────────────┘  │  │
│  Returns: { playerState, chunksToAdd,         │  │
│             chunksToRemove, newHeightmaps }   │  │
└───────────────────────────────────────────────┘  │
                                                   │
┌──────────────────────────────────────────────────▼────────────┐
│                      WebGPU Renderer                           │
│  ┌─────────────────┐   ┌──────────────────┐                   │
│  │ Terrain Pipeline │   │  Texture Manager │                   │
│  │ - Vertex shader  │   │  - GPUTextures   │                   │
│  │ - Fragment shader│   │  - Samplers      │                   │
│  │ - Splatmap blend │   └──────────────────┘                   │
│  │ - Fog / sky      │                                          │
│  └─────────────────┘                                          │
└────────────────────────────────────────────────────────────────┘
```

### 3.3 Layer 1 — App Shell (React 19 + Vite 6 + TypeScript)

TypeScript is a **thin bridge**. It does not compute physics, manage world state, or determine chunk coordinates. Its only jobs are:

- Mount a `<canvas>` element and initialize the WebGPU context
- Capture raw keyboard and mouse events; serialize to input JSON; send to the WASM worker each frame
- Receive `WorldState` back from the worker (player position, pitch/yaw, chunks to add/remove)
- Upload new chunk GPU buffers (vertex/index data returned from WASM)
- Release GPU buffers for evicted chunks
- Drive WebGPU rendering each frame using the player position from WASM
- React UI: settings panel, texture uploader, HUD overlay

**Key components:**
```
src/
  App.tsx                  — root, canvas ref, WebGPU init
  components/
    GameCanvas.tsx         — canvas + pointer lock + resize observer
    HUD.tsx                — crosshair, position/FPS display (data from WASM state)
    SettingsPanel.tsx      — terrain params forwarded to WASM on change
    TextureUploader.tsx    — drag-and-drop image → GPUTexture
  hooks/
    useWebGPU.ts           — device, adapter, surface config
    useGameLoop.ts         — requestAnimationFrame, delta time, worker dispatch
    useTerrainSettings.ts  — terrain params state (React only)
  engine/
    GameEngine.ts          — rAF loop: poll input → postMessage → recv WorldState → render
    InputSystem.ts         — keyboard Set + mouse delta accumulation (raw events only)
    FPSCamera.ts           — builds view/proj matrix from WASM-provided yaw/pitch/position
```

**What TypeScript does NOT do:**
- No physics math (gravity, velocity, collision, slope)
- No chunk coordinate arithmetic
- No world radius or distanceThreshold calculations
- No player position or velocity updates

### 3.4 Layer 2 — Go WASM Engine (Noise + Physics + World)

All CPU-intensive work and all game state runs in Go 1.25, compiled to WASM, executed inside a Web Worker. The WASM module is the authoritative game engine.

**Go package structure:**

```
wasm/
  main.go           — syscall/js export registration
  noise/
    simplex.go      — OpenSimplex2 / FBm (primary, mirrors terra-major FastNoiseLite)
    perlin.go       — 3D Perlin with skew (mirrors terrain-generator-unity3d NoiseProvider)
  terrain/
    heightmap.go    — GenerateHeightmap() using terra-major SimplexNoise approach
    normals.go      — ComputeNormals() central differences
    image.go        — DecodeHeightmapImage() PNG/JPG → float32
    config.go       — TerrainChunkConfig struct (mirrors terra-major TerrainChunkConfig)
  physics/
    capsule.go      — Capsule struct, radius=0.35, halfHeight=0.9
    gravity.go      — velocity integration, gravity = -19.62
    collision.go    — heightfield collision resolution, ground check (checkDistance=0.4)
    slope.go        — slope angle from terrain normal, slopeLimit=65°
    player.go       — UpdatePlayer() — full physics step, returns new PlayerState
  world/
    world.go        — WorldUpdate(), chunk radius logic, distanceThreshold=1100
    registry.go     — chunk registry (mirrors ChunkCache state machine)
    neighborhood.go — XUp/XDown/ZUp/ZDown tracking, seam stitching data
    config.go       — world constants: initialRenderRadius=2048, renderRadius=512
```

**Terrain noise (terra-major approach as primary):**

The height function mirrors `TerrainChunk.GetHeight()` from terra-major, with full FBm layering:

```go
// terrain/heightmap.go
// Primary: multi-octave simplex FBm (mirrors terra-major SimplexNoiseGenerator)
func GetHeight(worldX, worldZ float64, cfg TerrainChunkConfig) float64 {
    noise := 0.0
    freq := cfg.Frequency
    amp := cfg.Amplitude
    for i := 0; i < cfg.Octaves; i++ {
        // OpenSimplex2 evaluation (mirrors FastNoiseLite OpenSimplex2)
        noise += simplex.Evaluate2D((worldX+cfg.Offset.X)*freq,
                                    (worldZ+cfg.Offset.Z)*freq) * amp
        freq *= cfg.Lacunarity
        amp  *= cfg.Persistence
    }
    return clamp(noise*cfg.Gain, cfg.MinValue, cfg.MaxValue)
}

// Secondary: apply XZ skew rotation before noise (mirrors terrain-generator NoiseProvider)
// Used optionally to reduce grid alignment artifacts
func skewXZ(x, z float64) (float64, float64) {
    s := (x + z) * -0.211324865405187
    return x + s, z + s
}
```

**TerrainChunkConfig (mirrors terra-major `TerrainChunkConfig`, locally generated):**

```go
// terrain/config.go
type TerrainChunkConfig struct {
    ID                 string
    Position           Vec3
    Dimension          int     // chunk XZ size, default 512 (matches terra-major renderRadius)
    Height             int     // max terrain height, default 100
    DetailResolution   int
    ResolutionPerPatch int
    HeightmapResolution int   // default 129 (matches terrain-generator-unity3d)
    AlphamapResolution  int   // default 129
    Seed               int
    Gain               float64 // default 1.0
    Octaves            int     // default 6
    Frequency          float64 // default 0.001 (world-scale)
    Lacunarity         float64 // default 2.0
    Persistence        float64 // default 0.5
    Amplitude          float64 // default 1.0
    Offset             Vec3
    MinValue           float64
    MaxValue           float64
}
```

**Normal map computation:**
```go
// terrain/normals.go
// Central differences — same mathematical approach as terrain-generator-unity3d GetSteepness()
func ComputeNormals(heightmap []float32, resolution int, chunkSize, heightScale float64) []float32
// Returns flat [nx, ny, nz] per vertex (resolution*resolution*3), normalized
```

**Heightmap image import:**
```go
// terrain/image.go
func DecodeHeightmapImage(pngBytes []byte, outputResolution int) []float32
// Decodes PNG/JPG, samples grayscale channel, returns normalized float32 heightmap
```

**Web Worker message protocol:**
```typescript
// Worker receives each frame:
{ type: 'TICK', input: InputState, dt: number }

// Worker returns each frame:
{
  type: 'WORLD_STATE',
  playerState: PlayerState,     // pos, vel, yaw, pitch, isGrounded, isSprinting, stamina
  chunksToAdd: ChunkData[],     // new chunks with heightmap + normals Float32Arrays
  chunksToRemove: ChunkCoord[]  // coords to evict
}

// Worker receives on texture upload:
{ type: 'DECODE_HEIGHTMAP', imageBytes: ArrayBuffer, chunkCoord: ChunkCoord, resolution: number }
// Returns:
{ type: 'HEIGHTMAP_DECODED', chunkCoord: ChunkCoord, heightmap: Float32Array }
```

**Chunk pipeline (mirrors terrain-generator-unity3d `ChunkCache` in Go):**
```
REQUESTED → GENERATING (goroutine dispatched, max 3 concurrent) → READY → UPLOADED
```
Go manages this state machine internally. TypeScript only sees `chunksToAdd` and `chunksToRemove` in the response.

### 3.5 Layer 3 — WebGPU Renderer

**Initialization sequence:**
```typescript
const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
const device  = await adapter.requestDevice();
const context = canvas.getContext('webgpu');
const format  = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format, alphaMode: 'opaque' });
```

**Render pipeline per chunk:**

Each terrain chunk is a single `GPURenderPipeline` draw call:

- **Vertex buffer:** interleaved `[x, y, z, nx, ny, nz, u, v, steepness]` per vertex
- **Index buffer:** triangle strip indices for `(resolution-1)²×2` triangles
- **Uniform buffer:** view-projection matrix, world offset, height scale, chunk size
- **Texture bindings:** diffuse0 (flat), diffuse1 (steep), normalMap, splatMap

**Mesh generation (TypeScript, from WASM output):**
```typescript
// resolution = 129, chunkSize = 100, heightScale = 40
function buildTerrainMesh(heightmap: Float32Array, normals: Float32Array, resolution: number): TerrainMesh {
    // vertices: resolution * resolution
    // For each vertex at grid (xi, zi):
    //   x = xi / (resolution-1) * chunkSize
    //   y = heightmap[zi*resolution + xi] * heightScale
    //   z = zi / (resolution-1) * chunkSize
    //   u = xi / (resolution-1),  v = zi / (resolution-1)
    //   steepness = dot(normal, vec3(0,1,0)) → used in fragment shader for splatting
    //
    // indices: quad grid → 2 triangles each
    //   [zi*resolution+xi, zi*resolution+xi+1, (zi+1)*resolution+xi, ...]
}
```

**WGSL Vertex Shader:**
```wgsl
struct VertexIn {
  @location(0) position : vec3f,
  @location(1) normal   : vec3f,
  @location(2) uv       : vec2f,
  @location(3) steepness: f32,
}

struct VertexOut {
  @builtin(position) clipPos   : vec4f,
  @location(0)       worldPos  : vec3f,
  @location(1)       normal    : vec3f,
  @location(2)       uv        : vec2f,
  @location(3)       steepness : f32,
}

@vertex fn vs_main(v: VertexIn) -> VertexOut {
  var out: VertexOut;
  let worldPos = vec4f(v.position + chunkOffset, 1.0);
  out.clipPos  = uniforms.viewProj * worldPos;
  out.worldPos = worldPos.xyz;
  out.normal   = v.normal;
  out.uv       = v.uv;
  out.steepness = v.steepness;
  return out;
}
```

**WGSL Fragment Shader (splatmap + fog):**
```wgsl
@fragment fn fs_main(in: VertexOut) -> @location(0) vec4f {
  // Splatmap blend: flat vs steep texture by slope angle
  let flatColor  = textureSample(flatTex,  mySampler, in.uv * tilingScale);
  let steepColor = textureSample(steepTex, mySampler, in.uv * tilingScale);
  let blend      = smoothstep(0.6, 0.85, in.steepness); // steepness=0 is vertical
  var color      = mix(flatColor, steepColor, 1.0 - blend);

  // Normal map influence (tangent space)
  let nMap = textureSample(normalMap, mySampler, in.uv * tilingScale).rgb * 2.0 - 1.0;
  let N    = normalize(in.normal + nMap * normalStrength);

  // Simple directional light
  let lightDir = normalize(vec3f(0.4, 1.0, 0.3));
  let diff     = max(dot(N, lightDir), 0.0);
  color        = color * (ambientLight + diff * lightColor);

  // Exponential fog
  let dist     = length(in.worldPos - cameraPos);
  let fogFactor = exp(-fogDensity * dist * dist);
  color        = mix(vec4f(fogColor, 1.0), color, fogFactor);

  return color;
}
```

**Camera / view matrix:**
- Perspective projection: FOV 70°, near 0.1, far 2000
- View matrix built from player position + Euler angles (pitch/yaw)
- Updated every frame before render

**Depth buffer:** `depth24plus` format, cleared each frame.

**Multi-chunk rendering:**
```typescript
// Each active chunk has its own GPUBuffer set
// One render pass, multiple draw calls (one per chunk within view distance)
// Frustum culling: AABB test against camera frustum planes, skip out-of-frustum chunks
```

### 3.6 Layer 4 — WASM Physics Engine (Go)

Physics runs entirely in Go inside the WASM module. TypeScript does **not** perform any physics calculations.

**Constants (ported directly from terra-major `PlayerController.cs`):**

```go
// physics/player.go
const (
    WalkSpeed             = 5.0
    SprintSpeed           = 10.0
    JumpHeight            = 1.0
    Gravity               = -19.62
    SlopeLimit            = 65.0  // degrees
    GroundCheckDistance   = 0.4
    SprintDuration        = 15.0  // seconds
    SprintRechargeDuration = 5.0  // seconds
    CapsuleRadius         = 0.35
    CapsuleHalfHeight     = 0.9   // total 1.8m
    EyeHeight             = 0.8   // above center
)

// Jump velocity derived from jump height: v = sqrt(jumpHeight * -2 * gravity)
// = sqrt(1.0 * -2 * -19.62) ≈ 6.26 m/s
var JumpVelocity = math.Sqrt(JumpHeight * -2 * Gravity)
```

**PlayerState (Go struct, JSON-serialized back to TypeScript):**

```go
// physics/player.go
type PlayerState struct {
    Position    Vec3    `json:"position"`
    Velocity    Vec3    `json:"velocity"`
    Yaw         float64 `json:"yaw"`
    Pitch       float64 `json:"pitch"`  // clamped [-90, 70]
    IsGrounded  bool    `json:"isGrounded"`
    IsSprinting bool    `json:"isSprinting"`
    Stamina     float64 `json:"stamina"`  // 0..SprintDuration
}
```

**InputState (JSON from TypeScript each frame):**

```go
// physics/player.go
type InputState struct {
    MoveX     float64 `json:"moveX"`    // -1..1
    MoveZ     float64 `json:"moveZ"`    // -1..1
    MouseDX   float64 `json:"mouseDX"`  // raw pixels
    MouseDY   float64 `json:"mouseDY"`
    Jump      bool    `json:"jump"`
    Sprint    bool    `json:"sprint"`
    Sensitivity float64 `json:"sensitivity"`
}
```

**Physics step (Go — `go_updatePlayer` export):**

```go
// physics/player.go
func UpdatePlayer(state PlayerState, input InputState, dt float64, world *world.World) PlayerState {
    // 1. Mouse look: update yaw/pitch
    state.Yaw   += input.MouseDX * input.Sensitivity * 0.1
    state.Pitch -= input.MouseDY * input.Sensitivity * 0.1
    state.Pitch  = clamp(state.Pitch, -90, 70)

    // 2. Sprint stamina
    if input.Sprint && state.IsGrounded && state.Stamina > 0 {
        state.IsSprinting = true
        state.Stamina -= dt
    } else {
        state.IsSprinting = false
        state.Stamina = math.Min(SprintDuration, state.Stamina + dt*(SprintDuration/SprintRechargeDuration))
    }
    speed := WalkSpeed
    if state.IsSprinting { speed = SprintSpeed }

    // 3. Horizontal movement (yaw-rotated)
    sinY := math.Sin(state.Yaw * math.Pi / 180)
    cosY := math.Cos(state.Yaw * math.Pi / 180)
    state.Position.X += (input.MoveX*cosY + input.MoveZ*sinY) * speed * dt
    state.Position.Z += (-input.MoveX*sinY + input.MoveZ*cosY) * speed * dt

    // 4. Gravity + jump
    if input.Jump && state.IsGrounded {
        state.Velocity.Y = JumpVelocity
    }
    state.Velocity.Y += Gravity * dt
    state.Position.Y += state.Velocity.Y * dt

    // 5. Terrain collision (bilinear sample from in-WASM heightmap)
    groundY := world.SampleHeight(state.Position.X, state.Position.Z)
    bottomY := state.Position.Y - CapsuleHalfHeight - CapsuleRadius
    if bottomY < groundY {
        state.Position.Y = groundY + CapsuleHalfHeight + CapsuleRadius
        if state.Velocity.Y < 0 { state.Velocity.Y = 0 }
    }
    state.IsGrounded = (bottomY <= groundY + GroundCheckDistance)

    // 6. Slope limit check: if slope > SlopeLimit, cancel movement
    normal := world.SampleNormal(state.Position.X, state.Position.Z)
    slope  := math.Acos(normal.Y) * 180 / math.Pi
    if slope > SlopeLimit && state.Velocity.Y <= 0 {
        state.Position.X -= (input.MoveX*cosY + input.MoveZ*sinY) * speed * dt
        state.Position.Z -= (-input.MoveX*sinY + input.MoveZ*cosY) * speed * dt
    }

    return state
}
```

**WASM export:**

```go
// main.go
js.Global().Set("go_updatePlayer", js.FuncOf(func(this js.Value, args []js.Value) any {
    inputJSON  := args[0].String()
    dt         := args[1].Float()
    // deserialize input, run UpdatePlayer, serialize result
    resultJSON, _ := json.Marshal(UpdatePlayer(globalPlayerState, input, dt, globalWorld))
    globalPlayerState = result
    return string(resultJSON)
}))
```

### 3.7 Layer 5 — First-Person Input Bridge (TypeScript only)

TypeScript captures raw input events and relays them to the WASM worker each frame. It does **no physics computation**. After receiving `PlayerState` back from the worker, it builds the view/projection matrix for WebGPU.

**Input capture:**

```typescript
// engine/InputSystem.ts
export class InputSystem {
  private keys = new Set<string>();
  private mouseDX = 0;
  private mouseDY = 0;

  constructor() {
    document.addEventListener('keydown', e => this.keys.add(e.code));
    document.addEventListener('keyup',   e => this.keys.delete(e.code));
    document.addEventListener('mousemove', e => {
      if (!document.pointerLockElement) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
  }

  // Called each frame — returns InputState and resets mouse deltas
  flush(sensitivity: number): InputState {
    let moveX = 0, moveZ = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp'))    moveZ += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown'))  moveZ -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft'))  moveX -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveX += 1;
    const input: InputState = {
      moveX, moveZ,
      mouseDX: this.mouseDX, mouseDY: this.mouseDY,
      jump: this.keys.has('Space'),
      sprint: this.keys.has('ShiftLeft'),
      sensitivity,
    };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return input;
  }
}
```

**View matrix from WASM PlayerState:**

```typescript
// engine/FPSCamera.ts — builds view/projection matrix from WASM-provided state
export function buildViewMatrix(playerState: PlayerState): mat4 {
  const eyeY = playerState.position.y + EYE_HEIGHT;
  // yaw/pitch come from WASM — TypeScript just constructs the matrix
  const rot = mat4.fromEuler(playerState.pitch, playerState.yaw, 0);
  const forward = vec3.transformMat4([0, 0, -1], rot);
  const eye = [playerState.position.x, eyeY, playerState.position.z];
  return mat4.lookAt(eye, vec3.add(eye, forward), [0, 1, 0]);
}
```

**Game loop (relays, never computes):**

```typescript
// engine/GameEngine.ts
function tick(dt: number) {
  const input = inputSystem.flush(settings.sensitivity);
  worker.postMessage({ type: 'TICK', input, dt });
  // Response handled in onmessage → updates playerState, uploads GPU buffers, renders
}
```

### 3.8 Layer 6 — Texture & Image System

**Texture slots per terrain layer:**

| Slot | Type | Description |
|---|---|---|
| `flatDiffuse` | GPUTexture (RGBA8) | Texture for flat/low-slope areas |
| `steepDiffuse` | GPUTexture (RGBA8) | Texture for steep/cliff areas |
| `flatNormal` | GPUTexture (RGBA8) | Normal map for flat areas |
| `steepNormal` | GPUTexture (RGBA8) | Normal map for steep areas |
| `userHeightmap` | GPUTexture (R32F or R8) | Optional: user-uploaded heightmap image |

**Texture upload pipeline:**
```typescript
async function uploadTexture(device: GPUDevice, source: ImageBitmap | HTMLImageElement): Promise<GPUTexture> {
  const texture = device.createTexture({
    size: [source.width, source.height, 1],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture(
    { source, flipY: true },
    { texture },
    [source.width, source.height]
  );
  return texture;
}
```

**User heightmap import flow:**
1. User drags/drops a PNG or JPG image in the `TextureUploader` component
2. Image bytes sent to Go WASM via worker: `go_decodeHeightmapImage(bytes, resolution)`
3. Go decodes image, samples grayscale values, returns `Float32Array` heightmap
4. This heightmap replaces procedural noise for the affected chunk (or all chunks if global)
5. Mesh rebuilt, GPU buffers re-uploaded

**Splatmap blending (shader-driven, no separate texture):**

The splatmap is not stored as a texture — it is computed per-fragment from the terrain normal's Y component:
```wgsl
// steepness fed from vertex shader (dot(normal, up))
let splatWeight = smoothstep(0.6, 0.85, in.steepness);
color = mix(steepColor, flatColor, splatWeight);
```

This avoids a separate splatmap texture upload while producing the same visual result as the Unity splatmap system.

### 3.9 Data Flow

```
User Input (keyboard/mouse)
    │
    ▼
Game Loop (rAF, ~16ms)
    ├── 1. InputSystem.flush() — serialize InputState JSON, reset mouse delta
    │
    ├── 2. worker.postMessage({ type: 'TICK', input: InputState, dt })
    │            │
    │            ▼ (inside Web Worker — Go WASM)
    │         go_updatePlayer(inputJSON, dt)
    │           → UpdatePlayer(): mouse look, movement, gravity, collision, slope
    │         go_worldUpdate(playerX, playerZ)
    │           → add/remove chunk IDs based on renderRadius + distanceThreshold
    │           → for added chunks: GenerateHeightmap() + ComputeNormals()
    │            │
    │            ▼
    │         postMessage back: { playerState, chunksToAdd[], chunksToRemove[] }
    │
    ├── 3. Receive WorldState from worker:
    │     - Upload GPUBuffers for each new chunk (vertex/index/normals)
    │     - Release GPUBuffers for removed chunks
    │     - Store latest playerState (authoritative from WASM)
    │
    └── 4. Renderer.render(playerState, activeChunks)
            ├── FPSCamera.buildViewMatrix(playerState) — yaw/pitch/pos from WASM
            ├── frustumCull(activeChunks)
            ├── for each visible chunk:
            │     encode draw calls using GPU buffers
            └── submit command buffer
```

---

## 4. Directory Structure

```
terrain-webgpu/
├── PLAN.md                    ← This file
├── README.md
├── package.json               ← React 19, Vite 6, TypeScript
├── vite.config.ts
├── tsconfig.json
│
├── wasm/                      ← Go 1.25 WASM game engine (all logic)
│   ├── go.mod
│   ├── go.sum
│   ├── main.go                ← syscall/js export registration
│   ├── noise/
│   │   ├── simplex.go         ← OpenSimplex2 / FBm (primary — mirrors terra-major FastNoiseLite)
│   │   ├── perlin.go          ← Perlin with XZ skew (mirrors terrain-generator NoiseProvider)
│   │   └── noise_test.go
│   ├── terrain/
│   │   ├── config.go          ← TerrainChunkConfig (mirrors terra-major TerrainChunkConfig)
│   │   ├── heightmap.go       ← GenerateHeightmap() using simplex FBm
│   │   ├── normals.go         ← ComputeNormals() central differences
│   │   ├── image.go           ← DecodeHeightmapImage() PNG/JPG → float32
│   │   └── heightmap_test.go
│   ├── physics/
│   │   ├── player.go          ← PlayerState, InputState, UpdatePlayer()
│   │   ├── capsule.go         ← Capsule struct, constants
│   │   ├── collision.go       ← bilinear height sample, ground check, collision resolve
│   │   ├── slope.go           ← slope angle from normal, slopeLimit check
│   │   └── physics_test.go    ← unit tests for UpdatePlayer() at boundary conditions
│   ├── world/
│   │   ├── world.go           ← WorldUpdate(), SampleHeight(), SampleNormal()
│   │   ├── registry.go        ← chunk registry + state machine (mirrors ChunkCache)
│   │   ├── neighborhood.go    ← XUp/XDown/ZUp/ZDown tracking, seam stitch data
│   │   ├── config.go          ← world constants (renderRadius=512, initialRenderRadius=2048)
│   │   └── world_test.go
│   └── Makefile               ← `make wasm` → builds terrain.wasm (GOOS=js GOARCH=wasm go1.25)
│
├── public/
│   ├── wasm_exec.js           ← Go 1.25 runtime bridge (copy from $GOROOT/misc/wasm/)
│   └── terrain.wasm           ← Build output (gitignored, built by CI)
│
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   │
│   ├── components/
│   │   ├── GameCanvas.tsx     ← canvas ref, pointer lock, resize observer
│   │   ├── HUD.tsx            ← crosshair, position/FPS (data from WASM PlayerState)
│   │   ├── SettingsPanel.tsx  ← terrain params; changes forwarded to WASM via worker
│   │   └── TextureUploader.tsx← drag-drop texture/heightmap upload → GPUTexture
│   │
│   ├── hooks/
│   │   ├── useWebGPU.ts       ← device/adapter/context init
│   │   ├── useGameLoop.ts     ← rAF loop, delta time, worker dispatch
│   │   └── useTerrainSettings.ts
│   │
│   ├── engine/
│   │   ├── GameEngine.ts      ← thin loop: flush input → postMessage → render
│   │   ├── InputSystem.ts     ← keyboard Set + mouse delta (raw events only, no math)
│   │   ├── FPSCamera.ts       ← view/proj matrix from WASM-provided yaw/pitch/position
│   │   │
│   │   ├── renderer/
│   │   │   ├── Renderer.ts            ← WebGPU render pass setup
│   │   │   ├── TerrainPipeline.ts     ← GPURenderPipeline for terrain
│   │   │   ├── MeshBuilder.ts         ← Float32Array heightmap → GPUBuffer vertex/index
│   │   │   ├── TextureManager.ts      ← GPUTexture lifecycle, splatmap
│   │   │   └── shaders/
│   │   │       ├── terrain.vert.wgsl
│   │   │       └── terrain.frag.wgsl
│   │   │
│   │   └── worker/
│   │       ├── terrain.worker.ts  ← Web Worker: loads Go WASM, handles TICK messages
│   │       └── WasmBridge.ts      ← typed wrappers for go_updatePlayer / go_worldUpdate
│   │
│   └── types/
│       ├── terrain.ts             ← ChunkData, PlayerState, InputState, WorldState
│       └── webgpu.d.ts            ← WebGPU type augmentations if needed
│
└── .github/
    └── workflows/
        └── ci.yml                 ← install Go 1.25, build WASM, run go test, Vite build
```

---

## 5. Key Data Structures

```typescript
// src/types/terrain.ts

// Mirrors terra-major TerrainChunkConfig — all values generated locally in WASM
interface TerrainChunkConfig {
  id: string;
  position: [number, number, number];
  dimension: number;          // chunk XZ size (default: 512, matches terra-major renderRadius)
  height: number;             // max terrain height (default: 100)
  detailResolution: number;
  resolutionPerPatch: number;
  heightmapResolution: number; // default: 129 (matches terrain-generator-unity3d)
  alphamapResolution: number;  // default: 129
  seed: number;
  gain: number;               // default: 1.0
  octaves: number;            // default: 6
  frequency: number;          // default: 0.001 (world-scale, not normalized)
  lacunarity: number;         // default: 2.0
  persistence: number;        // default: 0.5
  amplitude: number;          // default: 1.0
  offset: [number, number, number];
  minValue: number;
  maxValue: number;
}

interface ChunkCoord {
  x: number;  // chunk grid X
  z: number;  // chunk grid Z
}

type ChunkStatus = 'requested' | 'generating' | 'ready' | 'uploaded' | 'active';

interface ChunkData {
  coord: ChunkCoord;
  status: ChunkStatus;
  heightmap: Float32Array | null;  // [resolution * resolution], normalized 0..1
  normals: Float32Array | null;    // [resolution * resolution * 3], world-space
  gpuBuffers: ChunkGPUBuffers | null;
  worldOffset: [number, number, number]; // [x, 0, z] in world units
}

interface ChunkGPUBuffers {
  vertex: GPUBuffer;
  index: GPUBuffer;
  indexCount: number;
  uniform: GPUBuffer;
  bindGroup: GPUBindGroup;
}

// Authoritative player state — returned from WASM every frame
interface PlayerState {
  position: [number, number, number];
  velocity: [number, number, number];
  yaw: number;             // degrees, horizontal
  pitch: number;           // degrees, clamped [-90, 70]
  isSprinting: boolean;
  isGrounded: boolean;
  stamina: number;         // 0..SprintDuration (15s)
}

// Input serialized from TypeScript each frame → posted to WASM worker
interface InputState {
  moveX: number;           // -1..1
  moveZ: number;           // -1..1
  mouseDX: number;         // raw pixel delta since last frame
  mouseDY: number;
  jump: boolean;
  sprint: boolean;
  sensitivity: number;
}

// WASM worker message types
type WorkerRequest =
  | { type: 'INIT'; wasmUrl: string }
  | { type: 'TICK'; input: InputState; dt: number }
  | { type: 'INIT_WORLD'; config: TerrainChunkConfig }
  | { type: 'DECODE_HEIGHTMAP'; imageBytes: ArrayBuffer; chunkCoord: ChunkCoord; resolution: number };

type WorkerResponse =
  | { type: 'READY' }
  | { type: 'WORLD_STATE'; playerState: PlayerState; chunksToAdd: ChunkData[]; chunksToRemove: ChunkCoord[] }
  | { type: 'HEIGHTMAP_DECODED'; chunkCoord: ChunkCoord; heightmap: Float32Array };
```

**Go structs (WASM engine — mirrors TypeScript types above):**

```go
// physics/player.go
type PlayerState struct {
    Position    Vec3    `json:"position"`
    Velocity    Vec3    `json:"velocity"`
    Yaw         float64 `json:"yaw"`
    Pitch       float64 `json:"pitch"`
    IsGrounded  bool    `json:"isGrounded"`
    IsSprinting bool    `json:"isSprinting"`
    Stamina     float64 `json:"stamina"`
}

type InputState struct {
    MoveX       float64 `json:"moveX"`
    MoveZ       float64 `json:"moveZ"`
    MouseDX     float64 `json:"mouseDX"`
    MouseDY     float64 `json:"mouseDY"`
    Jump        bool    `json:"jump"`
    Sprint      bool    `json:"sprint"`
    Sensitivity float64 `json:"sensitivity"`
}

// world/world.go
type WorldUpdate struct {
    ChunksToAdd    []ChunkGenResult `json:"chunksToAdd"`
    ChunksToRemove []ChunkCoord     `json:"chunksToRemove"`
}

type ChunkGenResult struct {
    Coord     ChunkCoord  `json:"coord"`
    Heightmap []float32   `json:"heightmap"` // resolution*resolution
    Normals   []float32   `json:"normals"`   // resolution*resolution*3
}
```

---

## 6. Implementation Guide — Milestone Pull Requests

Each milestone is a standalone PR targeting `main`. Each PR must:
- Pass all existing tests/lint
- Include a short `## Changes` section in the PR description
- Be reviewable in isolation (no PR depends on uncommitted work from another open PR)

---

### M1 — Project Scaffold

**Branch:** `feat/m1-scaffold`
**Goal:** Running Vite 6 + React 19 app with a WebGPU hello-triangle on canvas. Go 1.25 WASM build pipeline wired up. Worker loads WASM and responds to a ping.

**Commits:**
```
feat: init vite@6 react-ts project with eslint + prettier (React 19, Vite 6, TypeScript 5)
feat: add go 1.25 wasm module scaffold (go.mod, noise/ terrain/ physics/ world/, main.go, Makefile)
feat: configure vite to serve public/terrain.wasm with correct MIME type
feat: add useWebGPU hook — adapter/device/context init with error states
feat: add GameCanvas component — canvas ref, resize observer, pointer lock
feat: add WebGPU hello triangle (prove pipeline works end-to-end)
feat: add terrain.worker.ts — load wasm_exec.js (go 1.25) + terrain.wasm, respond to INIT
feat: add WasmBridge.ts — typed wrappers for all go exports (stub implementations)
chore: add ci.yml — go1.25 install, go test ./..., vite build
```

**Acceptance criteria:**
- [ ] `npm run dev` shows a canvas with a colored triangle
- [ ] DevTools console shows `[Worker] WASM Ready`
- [ ] `make -C wasm wasm` produces `public/terrain.wasm` using Go 1.25
- [ ] `go test ./...` passes in `wasm/`

---

### M2 — Go WASM Noise + World Engine

**Branch:** `feat/m2-wasm-noise-world`
**Goal:** Go implements the full noise/terrain/world stack. Exports `go_generateHeightmap`, `go_initWorld`, and `go_worldUpdate` to JS. Worker returns chunk heightmaps + normals on demand.

**Commits:**
```
feat(wasm/noise): implement OpenSimplex2 FBm (primary — mirrors terra-major FastNoiseLite OpenSimplex2)
feat(wasm/noise): implement perlin with XZ skew (secondary — mirrors terrain-generator NoiseProvider.rotateXZBeforeY)
feat(wasm/terrain): implement TerrainChunkConfig struct (mirrors terra-major TerrainChunkConfig, locally generated)
feat(wasm/terrain): implement GenerateHeightmap using terra-major simplex FBm approach
feat(wasm/terrain): implement ComputeNormals — central differences, normalized vec3 per vertex
feat(wasm/world): implement world constants (renderRadius=512, initialRenderRadius=2048, distanceThreshold=1100)
feat(wasm/world): implement chunk registry with state machine REQUESTED→GENERATING(max3)→READY→UPLOADED→ACTIVE
feat(wasm/world): implement go_initWorld(configJSON) — initialize world with TerrainChunkConfig
feat(wasm/world): implement go_worldUpdate(playerX, playerZ) — returns JSON diff {chunksToAdd, chunksToRemove}
feat(wasm/world): implement neighborhood tracking (XUp/XDown/ZUp/ZDown, mirrors ChunkCache neighbor tracking)
test(wasm): noise determinism, seam continuity, chunk state machine transitions
feat(worker): wire TICK/INIT_WORLD messages → WASM world functions → postMessage WorldState
```

**Acceptance criteria:**
- [ ] `go test ./noise/... ./terrain/... ./world/...` passes
- [ ] Adjacent chunk heightmaps share edge values (seam continuity test)
- [ ] `go_worldUpdate` returns chunk add/remove JSON correctly as player moves
- [ ] Worker round-trip for a 129×129 chunk < 50ms
- [ ] No main thread jank (Web Worker handles all WASM calls)

---

### M3 — Heightmap → Mesh Builder

**Branch:** `feat/m3-mesh-builder`
**Goal:** TypeScript `MeshBuilder` converts a heightmap Float32Array to interleaved vertex data and index buffer. Chunk is visible on screen (wireframe or flat shaded acceptable).

**Commits:**
```
feat(renderer): add MeshBuilder — heightmap + normals → interleaved vertex buffer
feat(renderer): add index buffer generation — (resolution-1)² quads → triangle list
feat(renderer): add TerrainPipeline — GPURenderPipeline for terrain geometry
feat(renderer): add terrain.vert.wgsl — position + world offset uniform
feat(renderer): add terrain.frag.wgsl — flat shaded by normal.y (debug view)
feat(renderer): add Renderer.ts — depth buffer, render pass, pipeline management
feat(engine): add ChunkManager stub — single test chunk, no streaming yet
feat(engine): wire GameEngine.render() → Renderer → single chunk visible
```

**Acceptance criteria:**
- [ ] A single 100×100 terrain chunk visible in browser
- [ ] Height correctly applied (hills/valleys visible)
- [ ] No z-fighting or depth issues
- [ ] Normals visually correct (flat-shading debug shows ridge orientation)
- [ ] 60 fps on a mid-range discrete GPU (Chrome/Edge)

---

### M4 — WebGPU Terrain Renderer

**Branch:** `feat/m4-renderer`
**Goal:** Full terrain WGSL shaders — splatmap texture blending by slope, normal mapping, directional light, exponential fog, multi-chunk rendering.

**Commits:**
```
feat(renderer): add TextureManager — GPUTexture creation, sampler, bind group layout
feat(renderer): load default flat + steep textures (bundled grass/rock PNGs)
feat(renderer): add terrain.frag.wgsl — slope-based splatmap blend
feat(renderer): add normal map support in fragment shader
feat(renderer): add directional light + ambient in fragment shader
feat(renderer): add exponential fog in fragment shader
feat(renderer): add sky color (clear color matches fog horizon)
feat(renderer): add frustum culling — AABB per chunk vs. 6 frustum planes
feat(renderer): multi-chunk draw — loop over active chunks, one draw call each
feat(renderer): uniform buffer per chunk — world offset, view-proj matrix
```

**Acceptance criteria:**
- [ ] Terrain visually textured with flat/steep blending visible on slopes
- [ ] Fog fades terrain to sky color at distance
- [ ] Normal mapping adds surface detail
- [ ] 4+ chunks rendering simultaneously without frame drops
- [ ] No visible seams between chunks

---

### M5 — First-Person Input Bridge

**Branch:** `feat/m5-input-bridge`
**Goal:** TypeScript captures raw keyboard/mouse events and forwards them to WASM each frame via postMessage. WASM returns PlayerState. View matrix is built from WASM-provided yaw/pitch/position — TypeScript does no physics.

**Commits:**
```
feat(input): add InputSystem — keyboard Set, mouse delta via pointerlockchange + mousemove, flush() per frame
feat(engine): add GameEngine.ts — rAF loop: flush input → postMessage TICK → receive WorldState → render
feat(engine): add FPSCamera.ts — build view/proj matrix from WASM PlayerState (yaw/pitch/position)
feat(worker): wire TICK message → go_updatePlayer + go_worldUpdate → return WorldState
feat(ui): add HUD component — crosshair, world position from WASM PlayerState, FPS counter
feat(ui): add pointer lock on canvas click, release on Escape
```

**Acceptance criteria:**
- [ ] Mouse look smooth (sensitivity slider works, no acceleration artifacts)
- [ ] Pitch clamped to -90°/+70° (enforced in WASM)
- [ ] WASD moves in camera-facing direction (movement computed in WASM, camera follows)
- [ ] HUD shows position values updating from WASM PlayerState
- [ ] Pointer lock acquired on click, released on Escape
- [ ] TypeScript contains zero physics math (grep confirms no gravity/velocity constants in TS)

---

### M6 — WASM Physics Engine

**Branch:** `feat/m6-wasm-physics`
**Goal:** Go physics package fully implemented and tested. Player stands on terrain, gravity works, jump works, slope limit enforced. All physics computation in Go WASM.

**Commits:**
```
feat(wasm/physics): implement PlayerState + InputState structs with JSON serialization
feat(wasm/physics): implement capsule constants (radius=0.35, halfHeight=0.9, eyeHeight=0.8)
feat(wasm/physics): implement gravity integration (gravity=-19.62) and velocity → position
feat(wasm/physics): implement bilinear height sampling from WASM-owned heightmap
feat(wasm/physics): implement ground check (checkDistance=0.4 from terra-major)
feat(wasm/physics): implement collision resolve — push player up when below terrain
feat(wasm/physics): implement slope limit (65°) — block movement on steep faces
feat(wasm/physics): implement jump (Space) — jumpVelocity=sqrt(1.0*-2*-19.62)≈6.26 m/s, only when grounded
feat(wasm/physics): implement sprint stamina (15s duration, 5s recharge from terra-major)
feat(wasm/physics): implement mouse look — yaw/pitch update + pitch clamp [-90, 70]
feat(wasm): export go_updatePlayer(inputJSON string, dt float64) string
test(wasm/physics): unit tests — collision resolution at boundary, slope blocking, jump velocity, stamina drain/recharge
feat(player): spawn player at terrain height + CapsuleHalfHeight + CapsuleRadius + 0.5 clearance
```

**Acceptance criteria:**
- [ ] Player rests on terrain, does not fall through
- [ ] Player falls when walking off an edge
- [ ] Jump launches player upward, gravity returns to terrain
- [ ] Slope > 65° blocks movement (verified on steep terrain)
- [ ] Sprint drains stamina, auto-recharges
- [ ] No jitter on flat terrain, no oscillation at chunk seams
- [ ] `go test ./physics/...` passes including boundary condition tests

---

### M7 — WASM World Management + Chunk Streaming

**Branch:** `feat/m7-wasm-world-streaming`
**Goal:** Infinite terrain streaming. As player walks, `go_worldUpdate` returns new chunk data to add and old chunk coords to remove. TypeScript only acts on the returned diff — no coordinate arithmetic in TS.

**Commits:**
```
feat(wasm/world): go_worldUpdate(playerX, playerZ) fully functional — returns chunksToAdd + chunksToRemove JSON
feat(wasm/world): circular radius test (x²+z² < renderRadius²) mirrors ChunkCache pattern
feat(wasm/world): distanceThreshold (1100 units) before triggering new chunk scan (mirrors World.cs)
feat(wasm/world): max 3 concurrent goroutines for chunk generation (mirrors MaxChunkThreads=3)
feat(wasm/world): neighbor stitching data in ChunkGenResult (XUp/XDown/ZUp/ZDown heights)
feat(worker): on TICK response, forward chunksToAdd and chunksToRemove to main thread
feat(engine): TypeScript uploads GPUBuffers for chunksToAdd; releases GPUBuffers for chunksToRemove
feat(renderer): multi-chunk draw — loop over active chunks, one draw call each
feat(renderer): frustum culling — AABB per chunk vs. 6 frustum planes
feat(ui): optional chunk debug overlay — loaded chunk positions (toggleable)
```

**Acceptance criteria:**
- [ ] Walking for 60 seconds without visible pop-in or frame drops
- [ ] Old chunks freed (GPU memory stable, verified in browser DevTools memory snapshot)
- [ ] Chunk boundaries seamless (no visible height discontinuities at seams)
- [ ] At most 3 chunks generating concurrently (verified via Go goroutine count)
- [ ] TypeScript contains zero chunk coordinate arithmetic (grep confirms)
- [ ] Chunk load time < 100ms wall clock per chunk

---

### M8 — Texture & Image Upload System

**Branch:** `feat/m8-textures`
**Goal:** User can upload flat texture, steep texture, normal maps, or a heightmap image. All applied in real time.

**Commits:**
```
feat(ui): add TextureUploader component — drag-drop file input for flat/steep/normal slots
feat(renderer): add hot-swap texture support — replace GPUTexture without pipeline rebuild
feat(wasm): implement DecodeHeightmapImage — PNG/JPG bytes → float32 heightmap
feat(worker): handle DECODE_HEIGHTMAP message → go_decodeHeightmapImage → return heightmap
feat(terrain): wire user heightmap → override procedural noise for affected chunks
feat(terrain): add heightmap blending — lerp between procedural and user heightmap (blend slider)
feat(ui): add texture tiling scale slider per texture slot
feat(ui): show texture preview thumbnail after upload
feat(ui): add "Reset to defaults" button per slot
```

**Acceptance criteria:**
- [ ] Uploading a JPG grass texture immediately applies to flat terrain areas
- [ ] Uploading a heightmap PNG reshapes terrain (regenerates mesh)
- [ ] Invalid file types show an error message, don't crash
- [ ] Very large images (4096×4096) handled without main thread freeze
- [ ] Resetting slot restores bundled default texture

---

### M9 — Polish, Performance & Packaging

**Branch:** `feat/m9-polish`
**Goal:** Production-ready build. Performance targets met. Readme and user-facing docs complete.

**Commits:**
```
perf: move mesh building to worker (transfer vertex data as ArrayBuffer)
perf: add LOD system — reduce mesh resolution for distant chunks (65x65 for chunks > 2 away)
perf: GPU buffer reuse — pre-allocate pool for (resolution-1)² index count
perf: add frustum culling for sub-chunk granularity (large open worlds)
feat: add sky dome / procedural sky gradient (horizon to zenith color)
feat: add configurable sun direction → light direction in shader uniform
feat: add water plane at y=0 (optional, simple blue plane with alpha)
feat: add fullscreen toggle (F11 or button)
feat: add settings persistence (localStorage for terrain params + mouse sensitivity)
chore: add README.md with setup instructions, screenshots, architecture summary
chore: optimize WASM binary size (TinyGo or wasm-opt)
chore: Vite production build — code split, asset hashing, wasm copy
chore: update ci.yml — production build artifact, wasm-opt pass
```

**Acceptance criteria:**
- [ ] 60fps sustained on a mid-range integrated GPU (Apple M1) at 4 render chunk radius
- [ ] WASM binary < 2MB after wasm-opt
- [ ] Production build passes Lighthouse performance score ≥ 85
- [ ] No memory leaks after 10 minutes of play (Chrome Memory tab)
- [ ] Works in Chrome 119+, Edge 119+ (WebGPU GA)
- [ ] README covers: install, dev, build, architecture overview

---

## 7. WebGPU Shader Architecture

### Bind Group Layout (terrain pipeline)

```
Group 0 — per-frame uniforms (shared across all chunks)
  Binding 0: uniform buffer
    - viewProjMatrix: mat4x4f
    - cameraPos: vec3f
    - fogDensity: f32
    - fogColor: vec3f
    - lightDir: vec3f
    - ambientIntensity: f32
    - lightColor: vec3f
    - normalStrength: f32

Group 1 — per-chunk uniforms
  Binding 0: uniform buffer
    - chunkWorldOffset: vec3f
    - heightScale: f32
    - chunkSize: f32

Group 2 — textures + samplers (shared)
  Binding 0: texture2D flatDiffuse
  Binding 1: texture2D steepDiffuse
  Binding 2: texture2D flatNormal
  Binding 3: texture2D steepNormal
  Binding 4: sampler (repeat, linear, mipmap)
```

### Vertex Buffer Layout

```
Stride: 36 bytes per vertex
  offset  0: position  vec3f (12 bytes)
  offset 12: normal    vec3f (12 bytes)
  offset 24: uv        vec2f  (8 bytes)
  offset 32: steepness f32    (4 bytes)
```

### Render Pass Structure

```
beginRenderPass {
  colorAttachment: { view: swapchain, loadOp: 'clear', clearColor: fogColor }
  depthAttachment: { view: depthView, loadOp: 'clear', clearDepth: 1.0 }
}
  setPipeline(terrainPipeline)
  setBindGroup(0, frameBindGroup)          // per-frame uniforms
  setBindGroup(2, textureBindGroup)        // shared textures
  for each visible chunk:
    setBindGroup(1, chunk.bindGroup)       // per-chunk offset
    setVertexBuffer(0, chunk.vertexBuffer)
    setIndexBuffer(chunk.indexBuffer, 'uint32')
    drawIndexed(chunk.indexCount)
endRenderPass
```

---

## 8. Go WASM API Contract

All Go functions registered on the global JS object via `js.Global().Set(...)`. All calls are synchronous from within the Web Worker (no async/await needed since WASM runs in worker thread):

```
go_ping()
  → "pong"   (WASM health check, called on worker startup)

go_initWorld(configJSON string)
  → ""   (initializes world with TerrainChunkConfig, sets seed/params for all chunks)
  configJSON: { seed, dimension, height, octaves, frequency, lacunarity, persistence, amplitude, offset, ... }

go_worldUpdate(playerX float64, playerZ float64)
  → JSON string: {
      "chunksToAdd": [{ "coord": {x, z}, "heightmap": [...], "normals": [...] }],
      "chunksToRemove": [{ x, z }]
    }
  Runs circular radius check (renderRadius=512), applies distanceThreshold=1100.
  Max 3 concurrent goroutines for chunk generation.

go_updatePlayer(inputJSON string, dt float64)
  → JSON string: {
      "position": [x, y, z],
      "velocity": [x, y, z],
      "yaw": float, "pitch": float,
      "isGrounded": bool, "isSprinting": bool, "stamina": float
    }
  inputJSON: { moveX, moveZ, mouseDX, mouseDY, jump, sprint, sensitivity }
  Runs full physics step: mouse look, movement, gravity, collision, slope limit, jump, sprint.

go_getChunkHeight(chunkX int, chunkZ int, worldX float64, worldZ float64)
  → float64   (bilinear interpolation into WASM-owned heightmap for named chunk)

go_decodeHeightmapImage(imageBytes Uint8Array, outputResolution int)
  → Float32Array[outputResolution * outputResolution]   (PNG/JPG grayscale → normalized heights)

go_generateHeightmap(configJSON string)
  → Float32Array[resolution * resolution]   (on-demand chunk generation, used by image override)

go_computeNormals(heightmapBuffer Float32Array, resolution int, chunkSize float64, heightScale float64)
  → Float32Array[resolution * resolution * 3]   (nx,ny,nz per vertex, normalized)
```

All Float32Array outputs use `js.TypedArrayOf` or copy into a pre-allocated JS buffer. The WASM module keeps all heightmap data in Go memory — TypeScript only receives Float32Array copies for GPU upload (not retained in JS heap long-term).

---

## 9. Performance Targets

| Metric | Target |
|---|---|
| Frame time (4-chunk radius, mid GPU) | < 16ms (60fps) |
| Chunk generation time (WASM, 129×129) | < 30ms |
| Worker round-trip (request → data received) | < 50ms |
| GPU memory per chunk | < 4MB (vertex + index buffers) |
| WASM binary size | < 2MB (post wasm-opt) |
| Initial page load (first terrain visible) | < 3s |
| Sustained play memory growth (10 min) | < 50MB delta |

---

## 10. Browser Compatibility & Fallbacks

| Browser | WebGPU | Status |
|---|---|---|
| Chrome 119+ | ✅ GA | Primary target |
| Edge 119+ | ✅ GA | Supported |
| Firefox 131+ | ⚠️ Nightly flag | Not officially supported yet |
| Safari 17.4+ | ⚠️ Partial | Test but don't block on |

**Fallback strategy:**

```typescript
// In useWebGPU.ts
if (!navigator.gpu) {
  // Show a clear error UI explaining WebGPU requirement
  // Provide links to compatible browsers
  // Do NOT attempt WebGL fallback (out of scope)
  setError('WebGPU is not supported in this browser. Please use Chrome 119+ or Edge 119+.');
  return;
}
```

**WASM compatibility:**
- WASM is supported in all modern browsers (Chrome 57+, Firefox 52+, Safari 11+)
- Go standard WASM target used (not TinyGo) for full stdlib support
- `wasm_exec.js` version must match the Go toolchain version exactly

---

*Plan authored from analysis of `terrain-generator-unity3d` and `terra-major-unity` source code.*
*See source repos for Unity-specific implementation details referenced throughout this document.*
