# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend
FROM golang:1.24-alpine AS backend-builder
WORKDIR /app
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server/main.go

# Stage 3: Final Image
FROM alpine:latest

# Add su-exec for privilege dropping and necessary packages
RUN apk --no-cache add ca-certificates tzdata su-exec

WORKDIR /app
COPY --from=backend-builder /app/server .
COPY --from=frontend-builder /app/dist ./frontend/dist
COPY entrypoint.sh .

# Define default env vars
ENV BIRDVIEW_DB_PATH=/app/data/birdview.db
ENV BIRDVIEW_DATA_PATH=/data
ENV BIRDVIEW_FRONTEND_DIR=/app/frontend/dist
ENV PORT=8080

EXPOSE 8080
VOLUME ["/data", "/app/data"]

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["./server"]
