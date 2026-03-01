# terrain-webgpu

A browser-native, first-person infinite terrain explorer built with WebGPU, Go WASM, and React. Walk, sprint, and jump across procedurally generated terrain that loads seamlessly around you — no install, no plugins, just open a browser.

---

## Requirements

You only need **Docker** to build and run this project. Nothing else needs to be installed on your machine.

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine 24+)

That's it.

---

## Development

### Build the dev image

The dev image mounts your source code and rebuilds on change.

```bash
docker build --target dev -t terrain-webgpu:dev .
```

### Run the dev server

```bash
docker run --rm -it \
  -v $(pwd):/app \
  -p 5173:5173 \
  terrain-webgpu:dev
```

Open your browser at:

👉 **http://localhost:5173**

The dev server supports hot module reload — edits to `src/` are reflected immediately. Go WASM changes require a container restart to rebuild.

---

## Production

### Build the production image

The production image compiles everything — Go WASM, TypeScript, Vite — and serves the static bundle via nginx.

```bash
docker build --target production -t terrain-webgpu:prod .
```

### Run the production server

```bash
docker run --rm -p 8080:80 terrain-webgpu:prod
```

Open your browser at:

👉 **http://localhost:8080**

The production build is fully self-contained (~67 MB image). There are no external API calls or CDN dependencies.

---

## Platform Overview

terrain-webgpu is a real-time procedural terrain system designed to run entirely in the browser. The player spawns in the center of an infinite, seamless landscape and can explore freely in any direction. The world has no edge.

### What you can do

- **Walk** around the terrain using `W A S D`
- **Sprint** by holding `Shift`
- **Jump** with `Space`
- **Look around** by clicking to lock the mouse, then moving it
- **Press `Escape`** to release the mouse and access settings

### Settings panel

Click `Escape` to open the settings panel, where you can adjust:

- **Field of view** (FOV)
- **Fog density**
- **Mouse sensitivity**

---

## Architecture

The project is split into three layers that communicate via well-defined interfaces:

```
Browser
├── React + Vite (UI shell)
│   ├── GameCanvas — mounts the WebGPU canvas
│   └── SettingsPanel — runtime adjustments (FOV, fog, sensitivity)
│
├── WebGPU (rendering)
│   ├── Terrain mesh — vertex + index buffers per chunk, GPU-side
│   ├── Texture system — bundled grass + rock textures, slope-blended
│   ├── FPS camera — mouse-locked first-person view with perspective projection
│   └── Sky gradient — fullscreen quad behind the terrain
│
└── Go → WASM (game logic, runs in a Web Worker)
    ├── Noise engine — multi-octave FBM (Perlin) for height values
    ├── Heightmap — 129×129 grid per chunk, world-space continuous noise
    ├── Normals — extended 131×131 heightmap with 1-cell neighbor border
    │             so edge normals are computed from real cross-chunk data
    ├── World streaming — tracks which chunks are active, adds/removes
    │                     based on player position with circular radius
    ├── Physics — capsule collision, gravity, jumping, sprinting (WASM)
    └── Chunk registry — deduplication, eviction hysteresis
```

### How the world streams

The world is divided into **512×512 unit chunks**, each with a **129×129 heightmap**.

1. On every player movement (every ~128 units), the engine calls `worldUpdate(x, z)` in the WASM worker
2. Go calculates which chunks fall within a **1536-unit radius** (~3 chunks) from the player
3. New chunks are returned sorted **nearest-first** so the area around the player loads first
4. The TypeScript engine generates all new chunks **in parallel** (`Promise.all`) — WASM computes the mesh, WebGPU uploads the buffers
5. Chunks beyond a **2560-unit radius** (~5 chunks) are evicted and their GPU buffers freed

This gives a smooth, continuous horizon with no loading screens or visible pop-in.

### Seamless chunk boundaries

Each chunk's normals are computed from an **extended 131×131 heightmap** that samples one cell beyond the chunk boundary using the same continuous world-space noise function. This means the lighting at a chunk edge is computed with the real height values from the neighboring chunk — producing seamless normals across boundaries.

### Technology choices

| Layer | Technology | Why |
|---|---|---|
| Rendering | WebGPU | Low-level GPU access in the browser, compute-ready |
| Game logic | Go → WASM | Type-safe, fast, runs off the main thread in a Worker |
| UI | React 19 + Vite 7 | Fast iteration, minimal bundle |
| Physics | Go (WASM) | Capsule collision stays off the main thread |
| Serving | nginx (prod) / Vite (dev) | Zero-config static serving |
| Packaging | Docker | Single-command build, no local toolchain needed |

---

## Project Structure

```
terrain-webgpu/
├── wasm/                  # Go source — compiled to terrain.wasm
│   ├── main.go            # WASM exports (generateChunk, worldUpdate, physicsStep, …)
│   ├── terrain/           # Heightmap + normals generation
│   ├── world/             # Chunk registry, streaming, config
│   └── physics/           # Capsule collision, player movement
│
├── src/                   # TypeScript / React source
│   ├── engine/            # WebGPU rendering, chunk manager, input, camera
│   ├── components/        # React components (GameCanvas, SettingsPanel)
│   └── workers/           # Web Worker that hosts the WASM runtime
│
├── public/
│   └── textures/          # Bundled grass.jpg + rock.jpg (loaded automatically)
│
└── Dockerfile             # Multi-stage: dev | wasm-builder | web-builder | production
```

---

## License

MIT

