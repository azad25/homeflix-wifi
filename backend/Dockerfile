# Multi-stage Dockerfile for HomeFlix Backend with Hot Reloading Support
# Stage 1: Base image with all dependencies
FROM golang:1.21-bookworm as base

# Install system dependencies in a single layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    ffmpeg \
    libsqlite3-dev \
    sqlite3 \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    git \
    procps \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Install Air for hot reloading (compatible with Go 1.21)
RUN go install github.com/cosmtrek/air@v1.49.0

WORKDIR /app

# Create Python virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy and install Python dependencies first (better caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy go mod files and download dependencies (better caching)
COPY go.mod go.sum ./
RUN go mod download && go mod verify

# Stage 2: Development image with hot reloading
FROM base as development

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p thumbnails posters previews subtitles optimized logs

# Make scripts executable
RUN chmod +x /app/start-celery.sh /app/start_file_watcher.py

# Create Air configuration for hot reloading
RUN echo 'root = "." \n\
testdata_dir = "testdata" \n\
tmp_dir = "tmp" \n\
\n\
[build] \n\
  args_bin = [] \n\
  bin = "./tmp/main" \n\
  cmd = "go build -o ./tmp/main ." \n\
  delay = 1000 \n\
  exclude_dir = ["assets", "tmp", "vendor", "testdata", "node_modules"] \n\
  exclude_file = [] \n\
  exclude_regex = ["_test.go"] \n\
  exclude_unchanged = false \n\
  follow_symlink = false \n\
  full_bin = "" \n\
  include_dir = [] \n\
  include_ext = ["go", "tpl", "tmpl", "html"] \n\
  include_file = [] \n\
  kill_delay = "0s" \n\
  log = "build-errors.log" \n\
  poll = false \n\
  poll_interval = 0 \n\
  rerun = true \n\
  rerun_delay = 500 \n\
  send_interrupt = false \n\
  stop_on_root = false \n\
\n\
[color] \n\
  app = "" \n\
  build = "yellow" \n\
  main = "magenta" \n\
  runner = "green" \n\
  watcher = "cyan" \n\
\n\
[log] \n\
  main_only = false \n\
  time = false \n\
\n\
[misc] \n\
  clean_on_exit = false \n\
\n\
[screen] \n\
  clear_on_rebuild = false \n\
  keep_scroll = true' > .air.toml

EXPOSE 8251 5555

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8251/health || exit 1

# Development command with hot reloading
CMD ["/bin/sh", "-c", "air -c .air.toml"]

# Stage 3: Production build
FROM base as builder

# Copy source code
COPY . .

# Build the application with optimizations
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -o main .

# Stage 4: Production runtime
FROM debian:bookworm-slim as production

# Install only runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    sqlite3 \
    python3 \
    python3-venv \
    curl \
    procps \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

WORKDIR /app

# Copy Python virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy the binary and required files
COPY --from=builder /app/main .
COPY --from=builder /app/start-celery.sh .
COPY --from=builder /app/start_file_watcher.py .
COPY --from=builder /app/celery_app.py .
COPY --from=builder /app/tasks ./tasks
COPY --from=builder /app/requirements.txt .

# Create necessary directories with proper permissions
RUN mkdir -p thumbnails posters previews subtitles optimized logs && \
    chmod 755 thumbnails posters previews subtitles optimized logs

# Make scripts executable
RUN chmod +x /app/start-celery.sh /app/start_file_watcher.py

# Create non-root user for security
RUN groupadd -r homeflix && useradd -r -g homeflix homeflix && \
    chown -R homeflix:homeflix /app

USER homeflix

EXPOSE 8251

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8251/health || exit 1

# Production command
CMD ["/app/main"]
