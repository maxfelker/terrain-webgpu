# Stage 1: Build and test Go WASM
FROM golang:1.25-alpine AS wasm-builder
WORKDIR /app/wasm
COPY wasm/go.mod wasm/go.sum* ./
RUN go mod download
COPY wasm/ .
RUN go test ./... -count=1
RUN GOOS=js GOARCH=wasm go build -o /app/public/terrain.wasm . && \
    cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" /app/public/wasm_exec.js

# Stage 2: Test and build React + Vite app
FROM node:24-alpine AS web-builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
COPY --from=wasm-builder /app/public/terrain.wasm public/terrain.wasm
COPY --from=wasm-builder /usr/local/go/lib/wasm/wasm_exec.js public/wasm_exec.js
RUN npm test
RUN npm run build

# Stage 3: Dev — hot-reload Vite dev server with Go WASM
FROM node:24-alpine AS dev
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY --from=wasm-builder /app/public/terrain.wasm /wasm-dist/terrain.wasm
COPY --from=wasm-builder /app/public/wasm_exec.js /wasm-dist/wasm_exec.js
EXPOSE 5173
CMD ["sh", "-c", "mkdir -p public && cp /wasm-dist/terrain.wasm public/terrain.wasm && cp /wasm-dist/wasm_exec.js public/wasm_exec.js && npm run dev -- --host"]

# Stage 4: Production — serve with nginx
FROM nginx:alpine AS production
COPY --from=web-builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
