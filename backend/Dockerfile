FROM golang:1.21-bullseye AS builder

# Install dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    gcc \
    libc6-dev \
    sqlite3 \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application with CGO enabled
RUN CGO_ENABLED=1 go build -o main .

FROM debian:bullseye-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    sqlite3 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /root/

# Copy the binary
COPY --from=builder /app/main .

# Create directories
RUN mkdir -p thumbnails

EXPOSE 8251

CMD ["./main"]
