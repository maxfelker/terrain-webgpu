# Biome System Implementation Plan
## terrain-webgpu

---

## Research Summary: Biomes in Procedural Games

### No Man's Sky Approach
No Man's Sky uses a 3-layer noise system:
1. **Elevation noise** → base terrain height (already implemented)
2. **Temperature noise** → separate low-frequency FBm, varies across world space
3. **Humidity/Moisture noise** → another independent low-frequency FBm

These three values map to a biome type via a lookup table based on the **Whittaker Biome
Classification Chart**. Domain warping is applied before sampling temperature/humidity to
create organic, non-linear biome boundaries (no hard grid edges).

### Whittaker Biome Classification
The classic 2D chart (Temperature × Humidity) naturally enforces valid adjacency:

```
         Dry ←——————————— Humidity ———————————→ Wet
Hot   [ Desert ] [ Savanna ] [ Grassland ] [ Tropical ]
      [ Scrub  ] [ Grassland][ Forest    ] [ Rainforest]
Cold  [ Tundra ] [ Boreal   ] [ Boreal    ] [ Taiga     ]
```

Since biomes are laid out on a continuous 2D grid, neighbors are always similar:
- **Desert** neighbors Savanna, Grassland (humidity increases)
- **Swamp** neighbors Forest, Grassland (humidity decreases)
- **Desert ↔ Swamp** are never adjacent (opposite humidity extremes)
- Mountains are elevation-driven and can co-exist with any biome via height threshold

### Domain Warping
Before sampling temperature/humidity noise, warp the input coordinates using
a separate noise function. This distorts biome boundaries into organic, curvy
shapes instead of regular grid patterns.

```go
wx := fbm(x*0.003 + 0, z*0.003 + 0, seed)
wz := fbm(x*0.003 + 100, z*0.003 + 100, seed)
sampledTemp = temperatureNoise(x + wx*150, z + wz*150)
```

### Biome Blending / Stitching
At transition zones, blend terrain configs using distance-weighted sampling:
- Sample 2–3 nearest biome types at any world coordinate
- Weighted blend of their noise configs (amplitude, frequency, octaves)
- Smooth step function prevents sharp terrain "walls"

---

## Biome Definitions (Initial Set — 6 Biomes)

| Biome | Temp | Humidity | Amplitude | Freq | Octaves | Character |
|-------|------|----------|-----------|------|---------|-----------|
| **Grassland/Plains** | 0.4–0.7 | 0.3–0.6 | 80 | 0.0008 | 5 | Gentle rolling hills |
| **Desert** | 0.7–1.0 | 0.0–0.25 | 120 | 0.0005 | 3 | Long smooth dunes |
| **Mountains** | 0.0–0.4 | 0.2–0.7 | 600 | 0.0015 | 7 | Steep jagged peaks |
| **Valley** | 0.3–0.6 | 0.3–0.6 | 60 | 0.0006 | 4 | Low, wide, gentle |
| **Swamp** | 0.5–0.8 | 0.7–1.0 | 30 | 0.001 | 3 | Very flat, murky low ground |
| **Forest** | 0.3–0.7 | 0.5–0.8 | 100 | 0.001 | 5 | Moderate hills, dense flora |

### Biome Textures (Raster Images)

| Biome | Surface 1 | Surface 2 (slope) | Surface 3 (elevation) |
|-------|-----------|--------------------|-----------------------|
| Grassland | grass.jpg | rock.jpg | — |
| Desert | sand.jpg | sandstone.jpg | — |
| Mountains | rock.jpg | rock.jpg | snow.jpg (above snowLine) |
| Valley | grass.jpg | dirt.jpg | — |
| Swamp | mud.jpg | wet-rock.jpg | — |
| Forest | moss.jpg | rock.jpg | — |

New textures needed: `sand.jpg`, `sandstone.jpg`, `snow.jpg`, `dirt.jpg`, `mud.jpg`, `moss.jpg`, `wet-rock.jpg`

---

## Technical Architecture

### Go WASM Changes

```
wasm/
├── biome/
│   ├── biome.go           # BiomeDefinition struct, BiomeType enum
│   ├── registry.go        # Built-in biome library (all 6 biomes)
│   ├── selector.go        # Temperature/humidity noise → biome selection
│   ├── world_config.go    # WorldBiomeConfig: active biomes + seeds
│   └── biome_test.go      # Unit tests
├── terrain/
│   ├── config.go          # ChunkConfig gains BiomeConfig reference
│   └── terrain.go         # Terrain gen uses biome noise params
└── main.go                # WASM exports updated (biome data in generateChunk)
```

### TypeScript Changes

```
src/engine/
├── biome/
│   ├── BiomeRegistry.ts   # Client-side biome definitions (textures, visual params)
│   └── BiomeTypes.ts      # Shared type definitions
├── TextureManager.ts      # Extended: loads all biome textures
├── TerrainPipeline.ts     # Updated: binds biome texture uniforms
├── ChunkManager.ts        # Updated: stores + passes biome type per chunk
└── worker/
    └── WasmBridge.ts      # Updated: decodes biome data from WASM
```

### World Configuration System

A `WorldConfig` (JSON-compatible Go struct) defines a world before generation:

```go
type WorldConfig struct {
    Seed         int64          `json:"seed"`
    ActiveBiomes []string       `json:"activeBiomes"` // ["Desert", "Mountains", "Forest"]
    BiomeScale   float64        `json:"biomeScale"`   // Size of biome regions (units)
    Overrides    []BiomeOverride `json:"overrides"`   // Custom params per biome
}
```

---

## Milestone Roadmap

### Milestone 1 — Biome Foundation + Terrain Shape Variation
**Branch:** `feature/biome-m1-foundation`
**Goal:** Different terrain shapes per biome region (visible difference in topology)

**Go WASM:**
- `wasm/biome/biome.go`: `BiomeDefinition` struct with all noise params
- `wasm/biome/registry.go`: 6 built-in biomes
- `wasm/biome/selector.go`: temperature + humidity FBm noise, domain warping, Whittaker lookup
- `wasm/biome/world_config.go`: `WorldConfig` struct + WASM export `loadWorldConfig(json)`
- `wasm/terrain/terrain.go`: use biome's amplitude/frequency/octaves per chunk
- `wasm/main.go`: `generateChunk` returns biome type alongside heightmap + normals

**TypeScript:**
- `WasmBridge.ts`: decode biome type from generateChunk response
- `ChunkManager.ts`: store biome per chunk key
- `src/engine/biome/BiomeRegistry.ts`: client-side biome definitions

**Visual Change:** Desert regions are flat, sandy dunes. Mountains are dramatically taller and sharper. Plains roll gently. Swamps are nearly flat.

**Tests:** Go biome selection tests, blending tests, TypeScript WasmBridge tests  
**Deliverable:** PR → pause for review

---

### Milestone 2 — Biome Texture Variety
**Branch:** `feature/biome-m2-textures`
**Goal:** Each biome has visually distinct ground textures

**Changes:**
- Add texture assets: `public/textures/sand.jpg`, `snow.jpg`, `dirt.jpg`, `mud.jpg`, `moss.jpg`, `sandstone.jpg`
- `TextureManager.ts`: load and GPU-upload all biome texture sets
- `TerrainPipeline.ts`: bind biome texture set as uniform
- `terrain.frag.wgsl`: select texture set by biome ID, slope-based blend within biome
- `ChunkManager.ts`: pass biomeId in chunk uniform buffer

**Visual Change:** Desert = tan/sandy, Mountains = grey rock, Swamp = dark brown/green, Forest = rich green moss, Valley = dark soil.

**Tests:** TextureManager biome texture loading tests  
**Deliverable:** PR → pause for review

---

### Milestone 3 — Elevation Zones + Snow Caps
**Branch:** `feature/biome-m3-elevation`
**Goal:** Height-based texture variation within biomes

**Changes:**
- `BiomeDefinition`: add `SnowLine`, `RockLine` elevation thresholds
- `terrain.frag.wgsl`: blend snow texture above `SnowLine`, exposed rock on steep slopes
- Pass world-space height to fragment shader via vertex output
- Swamp: dark flat ground with water-edge color below `WaterLine`

**Visual Change:** Mountain peaks are white with snow. Steep rock faces visible on all steep terrain. Low swamp ground is dark and muddy.

**Tests:** Biome elevation config tests  
**Deliverable:** PR → pause for review

---

### Milestone 4 — Biome Stitching + World Config
**Branch:** `feature/biome-m4-stitching`
**Goal:** Smooth organic biome transitions; loadable world configs

**Changes:**
- `selector.go`: biome blending using weighted noise across transition zones
- `terrain.go`: weighted blend of biome noise configs at boundaries
- `terrain.frag.wgsl`: blend textures across biome transitions
- Adjacency validation (desert never neighbors swamp; insert buffer biome if needed)
- `loadWorldConfig(json)` WASM export wired and tested
- React Settings panel: "World Config" section

**Visual Change:** Walking from desert to mountain is gradual. No jarring terrain jumps at biome edges.

**Tests:** Biome blending weight tests, adjacency validation, world config loading  
**Deliverable:** PR → pause for review

---

### Milestone 5 — Flora Placement System
**Branch:** `feature/biome-m5-flora`
**Goal:** Biome-specific flora instances (trees, cacti, boulders, reeds)

**Changes:**
- `BiomeDefinition`: add `FloraRules []FloraRule` (type, density, slope/height range)
- `wasm/biome/flora.go`: Poisson disc sampling for flora positions per chunk
- `wasm/main.go`: `generateChunk` returns flora positions + types
- `src/engine/FloraRenderer.ts`: GPU instanced rendering
- Billboard textures: `public/textures/flora/tree.png`, `cactus.png`, `rock_scatter.png`, `reed.png`

**Flora by Biome:**

| Biome | Flora |
|-------|-------|
| Desert | Cacti (sparse), sandstone boulders |
| Mountains | Large boulders, sparse alpine shrubs |
| Forest | Dense trees, undergrowth |
| Swamp | Dead trees, reeds |
| Valley | Scattered trees, shrubs |
| Grassland | Sparse shrubs, wildflowers |

**Visual Change:** Walking through forest has dense tree coverage. Desert has scattered tall cacti. Mountain slopes have massive boulders.

**Tests:** Flora placement tests, instanced renderer tests  
**Deliverable:** PR → pause for review

---

## PR Process (Each Milestone)

1. Implement changes on feature branch
2. Run all Go tests: `go test ./...`
3. Run all TypeScript tests: `npm test`
4. Run Docker dev: `docker compose up dev` → verify visually
5. Run Docker prod: `docker compose up prod` → verify visually
6. Create PR to main
7. **⏸ PAUSE — wait for user review and approval**
8. On approval: merge PR, branch next milestone from updated main

---

## Key Implementation Notes

- **Texture assets**: use freely licensed textures (ambientCG, Poly Haven CC0)
- **Biome scale**: ~3000 world units per biome region (~6 chunks across)
- **Domain warp strength**: ~150 units (creates organic curved boundaries)
- **Transition zone width**: ~512 units (1 chunk) — smooth blend across this distance
- **Snow line elevation**: ~350 units above base (Mountain biome only initially)
- **Flora rendering**: billboard quads (spherical billboard in WGSL), GPU instanced
- **Adjacency rule**: Whittaker chart naturally enforces valid adjacency via temperature/humidity continuity
