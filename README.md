# Terrain WebGPU

A web-native first-person procedural terrain explorer built with React 19, Vite 7, Go 1.25 → WASM, and WebGPU.

## Stack

| Layer | Technology |
|---|---|
| App shell | React 19 + Vite 7 + TypeScript 5 |
| Game engine | Go 1.25 → WASM (physics, world, noise) |
| Renderer | WebGPU (WGSL shaders) |
| Runtime | Node 24 / Docker |

## Requirements

- **Docker + Docker Compose** (recommended)
- Or: Node 24+ and Go 1.25+ installed locally

> **Browser:** Chrome 119+ or Edge 119+ (WebGPU required)

## Development with Docker

```bash
# Start hot-reload dev server on http://localhost:5173
docker compose up dev

# Production build served via nginx on http://localhost:8080
docker compose --profile production up app
```

## Local development (without Docker)

```bash
# Build the Go WASM engine
make -C wasm wasm

# Install dependencies and start dev server
npm install
npm run dev
```

## Build

```bash
# WASM engine
make -C wasm wasm

# Production web build
npm run build

# Or build everything in Docker
docker build -t terrain-webgpu .
```

## Testing

```bash
# Go tests
cd wasm && go test ./...
```

## Architecture

See [PLAN.md](./PLAN.md) for the full technical architecture, layer diagram, and milestone plan.

