# Stage 1: Build Go WASM
FROM golang:1.25-alpine AS wasm-builder
WORKDIR /app/wasm
COPY wasm/go.mod wasm/go.sum* ./
RUN go mod download
COPY wasm/ .
RUN GOOS=js GOARCH=wasm go build -o /app/public/terrain.wasm .

# Stage 2: Build React + Vite app
FROM node:24-alpine AS web-builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
COPY --from=wasm-builder /app/public/terrain.wasm public/terrain.wasm
RUN npm run build

# Stage 3: Production — serve with nginx
FROM nginx:alpine AS production
COPY --from=web-builder /app/dist /usr/share/nginx/html
# Replace the full nginx config so we own MIME types and headers completely
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
