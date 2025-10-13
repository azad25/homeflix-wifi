# HomeFlix gRPC Migration Guide

## Overview
This guide provides step-by-step instructions for migrating your HomeFlix application from HTTP REST to gRPC for improved performance and real-time capabilities.

## Prerequisites

### Backend Dependencies
Add to `backend/go.mod`:
```go
require (
    google.golang.org/grpc v1.58.0
    google.golang.org/protobuf v1.31.0
    github.com/grpc-ecosystem/grpc-gateway/v2 v2.18.0
)
```

### Frontend Dependencies
Add to `frontend/package.json`:
```json
{
  "dependencies": {
    "nice-grpc": "^2.1.7",
    "nice-grpc-web": "^2.1.0",
    "@grpc/grpc-js": "^1.9.0",
    "@grpc/proto-loader": "^0.7.8"
  },
  "devDependencies": {
    "grpc-tools": "^1.12.4",
    "grpc_tools_node_protoc_ts": "^5.3.3"
  }
}
```

## Step 1: Protocol Buffer Setup

### 1.1 Install Protocol Buffer Compiler
```bash
# macOS
brew install protobuf

# Generate Go code
protoc --go_out=. --go-grpc_out=. proto/*.proto

# Generate TypeScript code for frontend
protoc --plugin=protoc-gen-ts=./node_modules/.bin/protoc-gen-ts \
       --ts_out=frontend/lib/grpc/generated \
       --js_out=import_style=commonjs,binary:frontend/lib/grpc/generated \
       proto/*.proto
```

### 1.2 Add Build Scripts
Add to `backend/Makefile`:
```makefile
.PHONY: proto
proto:
	protoc --go_out=. --go-grpc_out=. proto/*.proto

.PHONY: proto-frontend
proto-frontend:
	protoc --plugin=protoc-gen-ts=./node_modules/.bin/protoc-gen-ts \
	       --ts_out=frontend/lib/grpc/generated \
	       --js_out=import_style=commonjs,binary:frontend/lib/grpc/generated \
	       proto/*.proto
```

## Step 2: Backend Implementation

### 2.1 Update Main Server
Modify `backend/main.go`:
```go
package main

import (
    "context"
    "log"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/gin-gonic/gin"
    "homeflix-backend/internal/api"
    "homeflix-backend/internal/grpc"
    // ... other imports
)

func main() {
    // Initialize services (existing code)
    // ...

    // Start gRPC server
    grpcServer := grpc.NewGRPCServer(
        9090, // gRPC port
        mediaService,
        streamService,
        thumbnailService,
        userService,
        recommendationService,
        playbackService,
        geminiService,
        celeryService,
        alacService,
        tmdbService,
        mediaScanner,
        watcherService,
        redisCache,
        transcodeService,
    )

    grpcServer.RegisterServices()

    // Start gRPC server in goroutine
    go func() {
        if err := grpcServer.Start(); err != nil {
            log.Fatalf("Failed to start gRPC server: %v", err)
        }
    }()

    // Keep existing HTTP server for backward compatibility
    r := gin.Default()
    api.SetupRoutes(r, /* existing parameters */)

    httpServer := &http.Server{
        Addr:    ":8251",
        Handler: r,
    }

    // Start HTTP server in goroutine
    go func() {
        if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatalf("Failed to start HTTP server: %v", err)
        }
    }()

    // Graceful shutdown
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit

    log.Println("Shutting down servers...")

    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    // Shutdown HTTP server
    if err := httpServer.Shutdown(ctx); err != nil {
        log.Printf("HTTP server forced to shutdown: %v", err)
    }

    // Shutdown gRPC server
    grpcServer.Stop()

    log.Println("Servers exited")
}
```

### 2.2 Implement Remaining Service Servers
You'll need to implement the remaining gRPC service servers:

- `backend/internal/grpc/alac_service.go`
- `backend/internal/grpc/recommendation_service.go`
- `backend/internal/grpc/admin_service.go`
- `backend/internal/grpc/playback_service.go`

## Step 3: Frontend Implementation

### 3.1 Update Next.js Configuration
Add to `frontend/next.config.js`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['nice-grpc'],
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

module.exports = nextConfig;
```

### 3.2 Create gRPC Provider
Create `frontend/providers/GRPCProvider.tsx`:
```tsx
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { grpcClient } from '@/lib/grpc/client';

interface GRPCContextType {
  isConnected: boolean;
  client: typeof grpcClient;
  error: string | null;
}

const GRPCContext = createContext<GRPCContextType | null>(null);

export function GRPCProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Test connection
    const testConnection = async () => {
      try {
        // Try a simple call to test connection
        await grpcClient.getAllMedia(1, 0);
        setIsConnected(true);
        setError(null);
      } catch (err) {
        setIsConnected(false);
        setError(err instanceof Error ? err.message : 'Connection failed');
      }
    };

    testConnection();
  }, []);

  return (
    <GRPCContext.Provider value={{ isConnected, client: grpcClient, error }}>
      {children}
    </GRPCContext.Provider>
  );
}

export function useGRPC() {
  const context = useContext(GRPCContext);
  if (!context) {
    throw new Error('useGRPC must be used within a GRPCProvider');
  }
  return context;
}
```

### 3.3 Update App Layout
Modify `frontend/app/layout.tsx`:
```tsx
import { GRPCProvider } from '@/providers/GRPCProvider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <GRPCProvider>
          {children}
        </GRPCProvider>
      </body>
    </html>
  );
}
```

## Step 4: Migration Strategy

### Phase 1: Parallel Implementation (Week 1-2)
1. **Keep existing HTTP endpoints active**
2. **Implement gRPC services alongside HTTP**
3. **Add feature flags to switch between HTTP/gRPC**

```typescript
// frontend/lib/config.ts
export const USE_GRPC = process.env.NEXT_PUBLIC_USE_GRPC === 'true';

// frontend/lib/api.ts
import { USE_GRPC } from './config';
import { grpcClient } from './grpc/client';
import { httpClient } from './http/client';

export const apiClient = USE_GRPC ? grpcClient : httpClient;
```

### Phase 2: Service-by-Service Migration (Week 3-6)
1. **Start with Media Service** (basic CRUD operations)
2. **Move to Streaming Service** (video/audio streaming)
3. **Migrate Recommendations** (real-time updates)
4. **Update Playback Tracking** (bidirectional streaming)
5. **Migrate Admin Operations** (progress streaming)

### Phase 3: Real-time Features (Week 7-8)
1. **Implement bidirectional streaming for playback control**
2. **Add real-time progress synchronization**
3. **Enable live recommendation updates**
4. **Add real-time library change notifications**

### Phase 4: Performance Optimization (Week 9-10)
1. **Optimize chunk sizes for streaming**
2. **Implement connection pooling**
3. **Add retry mechanisms**
4. **Performance testing and tuning**

### Phase 5: Full Migration (Week 11-12)
1. **Remove HTTP endpoints gradually**
2. **Update all frontend components**
3. **Final testing and validation**
4. **Documentation updates**

## Step 5: Testing Strategy

### 5.1 Unit Tests
```go
// backend/internal/grpc/media_service_test.go
func TestMediaService_GetMedia(t *testing.T) {
    // Test gRPC service methods
}
```

### 5.2 Integration Tests
```typescript
// frontend/__tests__/grpc-integration.test.ts
describe('gRPC Integration', () => {
  test('should stream video successfully', async () => {
    // Test streaming functionality
  });
});
```

### 5.3 Performance Tests
```bash
# Use ghz for gRPC load testing
ghz --insecure \
    --proto proto/media.proto \
    --call homeflix.media.MediaService/GetAllMedia \
    --data '{"limit": 10}' \
    localhost:9090
```

## Step 6: Monitoring and Observability

### 6.1 Add gRPC Metrics
```go
// backend/internal/grpc/interceptors.go
func MetricsInterceptor() grpc.UnaryServerInterceptor {
    return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
        start := time.Now()
        resp, err := handler(ctx, req)
        duration := time.Since(start)
        
        // Record metrics
        recordGRPCMetrics(info.FullMethod, duration, err)
        
        return resp, err
    }
}
```

### 6.2 Add Logging
```go
func LoggingInterceptor() grpc.UnaryServerInterceptor {
    return grpc_zap.UnaryServerInterceptor(logger)
}
```

## Step 7: Deployment Considerations

### 7.1 Docker Configuration
Update `backend/Dockerfile`:
```dockerfile
# Expose both HTTP and gRPC ports
EXPOSE 8251 9090
```

### 7.2 Load Balancer Configuration
```nginx
# nginx.conf
upstream grpc_backend {
    server backend:9090;
}

server {
    listen 443 ssl http2;
    
    location /homeflix.media.MediaService/ {
        grpc_pass grpc://grpc_backend;
    }
    
    location /homeflix.streaming.StreamingService/ {
        grpc_pass grpc://grpc_backend;
    }
}
```

## Benefits After Migration

### Performance Improvements
- **7-10x faster** than HTTP REST
- **50% less bandwidth** usage with binary protocol
- **Real-time streaming** with native support
- **Bidirectional communication** for live features

### Developer Experience
- **Type safety** across frontend/backend
- **Automatic code generation** from proto files
- **Built-in streaming** support
- **Better error handling** with status codes

### Scalability
- **Connection multiplexing** over HTTP/2
- **Efficient serialization** with Protocol Buffers
- **Native load balancing** support
- **Better resource utilization**

## Troubleshooting

### Common Issues
1. **CORS Issues**: Configure gRPC-Web proxy properly
2. **Connection Timeouts**: Adjust keepalive settings
3. **Large Message Sizes**: Increase max message size limits
4. **Browser Compatibility**: Use gRPC-Web for browser clients

### Debug Commands
```bash
# Test gRPC server
grpcurl -plaintext localhost:9090 list

# Test specific method
grpcurl -plaintext -d '{"uuid": "test"}' \
    localhost:9090 homeflix.media.MediaService/GetMedia
```

This migration will transform your HomeFlix application into a high-performance, real-time streaming platform with significantly better user experience and system efficiency.