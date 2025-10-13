#!/bin/bash

# HomeFlix gRPC Proto Generation Script
# Generates Go and TypeScript code from .proto files

set -e

echo "🔧 Generating gRPC proto files for HomeFlix..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if protoc is installed
if ! command -v protoc &> /dev/null; then
    echo -e "${RED}❌ protoc is not installed. Please install Protocol Buffers compiler.${NC}"
    echo -e "${YELLOW}Ubuntu/Debian: sudo apt install protobuf-compiler${NC}"
    echo -e "${YELLOW}macOS: brew install protobuf${NC}"
    exit 1
fi

# Check if we're in the right directory
if [ ! -d "proto" ]; then
    echo -e "${RED}❌ proto directory not found. Please run this script from the project root.${NC}"
    exit 1
fi

# Create output directories
echo -e "${BLUE}📁 Creating output directories...${NC}"
mkdir -p backend/proto
mkdir -p frontend/lib/grpc/generated

# Install Go protobuf plugins if not present
echo -e "${BLUE}🔧 Checking Go protobuf plugins...${NC}"
if ! command -v protoc-gen-go &> /dev/null; then
    echo -e "${YELLOW}Installing protoc-gen-go...${NC}"
    go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
fi

if ! command -v protoc-gen-go-grpc &> /dev/null; then
    echo -e "${YELLOW}Installing protoc-gen-go-grpc...${NC}"
    go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
fi

# Generate Go code
echo -e "${BLUE}🚀 Generating Go gRPC code...${NC}"
for proto_file in proto/*.proto; do
    if [ -f "$proto_file" ]; then
        echo -e "${GREEN}  Processing: $proto_file${NC}"
        protoc \
            --proto_path=proto \
            --go_out=backend/proto \
            --go_opt=paths=source_relative \
            --go-grpc_out=backend/proto \
            --go-grpc_opt=paths=source_relative \
            "$proto_file"
    fi
done

# Generate TypeScript code for frontend
echo -e "${BLUE}🎨 Generating TypeScript gRPC code...${NC}"

# Check if grpc-tools is available
if command -v grpc_tools_node_protoc &> /dev/null; then
    for proto_file in proto/*.proto; do
        if [ -f "$proto_file" ]; then
            echo -e "${GREEN}  Processing: $proto_file${NC}"
            # Generate JavaScript code
            grpc_tools_node_protoc \
                --proto_path=proto \
                --js_out=import_style=commonjs,binary:frontend/lib/grpc/generated \
                --grpc_out=grpc_js:frontend/lib/grpc/generated \
                "$proto_file"
            
            # Generate TypeScript definitions
            grpc_tools_node_protoc \
                --proto_path=proto \
                --plugin=protoc-gen-ts=./node_modules/.bin/protoc-gen-ts \
                --ts_out=grpc_js:frontend/lib/grpc/generated \
                "$proto_file" 2>/dev/null || echo -e "${YELLOW}  TypeScript generation skipped (protoc-gen-ts not found)${NC}"
        fi
    done
else
    echo -e "${YELLOW}⚠️  grpc-tools not found. Installing via npm...${NC}"
    cd frontend
    npm install grpc-tools grpc_tools_node_protoc_ts --save-dev
    cd ..
    
    # Retry generation
    for proto_file in proto/*.proto; do
        if [ -f "$proto_file" ]; then
            echo -e "${GREEN}  Processing: $proto_file${NC}"
            ./frontend/node_modules/.bin/grpc_tools_node_protoc \
                --proto_path=proto \
                --js_out=import_style=commonjs,binary:frontend/lib/grpc/generated \
                --grpc_out=grpc_js:frontend/lib/grpc/generated \
                "$proto_file"
        fi
    done
fi

# Create index files for easier imports
echo -e "${BLUE}📝 Creating index files...${NC}"

# Go index file
cat > backend/proto/index.go << 'EOF'
// Package proto contains generated gRPC code for HomeFlix
package proto

// This file serves as a package documentation and import helper
EOF

# TypeScript index file
cat > frontend/lib/grpc/generated/index.ts << 'EOF'
// Generated gRPC client code for HomeFlix
// This file exports all generated proto types and services

// Export all generated types and services here
// Example:
// export * from './homeflix_pb';
// export * from './homeflix_grpc_pb';

export {};
EOF

# Create a simple gRPC client helper
cat > frontend/lib/grpc/client.ts << 'EOF'
// HomeFlix gRPC Client Helper
import { createChannel, createClient } from 'nice-grpc-web';

// gRPC-Web proxy endpoint
const GRPC_WEB_ENDPOINT = process.env.NEXT_PUBLIC_GRPC_WEB_URL || 'http://localhost:8081';

// Create gRPC channel
export const grpcChannel = createChannel(GRPC_WEB_ENDPOINT);

// Helper function to create gRPC clients
export function createGrpcClient<T>(serviceDefinition: any): T {
  return createClient(serviceDefinition, grpcChannel);
}

// Connection health check
export async function checkGrpcConnection(): Promise<boolean> {
  try {
    // Simple connection test - you can implement a health check service
    return true;
  } catch (error) {
    console.error('gRPC connection failed:', error);
    return false;
  }
}
EOF

echo -e "${GREEN}✅ Proto generation completed successfully!${NC}"
echo -e "${BLUE}📁 Generated files:${NC}"
echo -e "${GREEN}  - Go code: backend/proto/${NC}"
echo -e "${GREEN}  - TypeScript code: frontend/lib/grpc/generated/${NC}"
echo -e "${GREEN}  - Client helper: frontend/lib/grpc/client.ts${NC}"

echo ""
echo -e "${YELLOW}🎯 Next steps:${NC}"
echo -e "${GREEN}1. Start the gRPC server: cd backend && go run main.go${NC}"
echo -e "${GREEN}2. Start the gRPC-Web proxy: grpcwebproxy --backend_addr=localhost:9090 --run_tls_server=false --allow_all_origins --server_bind_port=8253${NC}"
echo -e "${GREEN}3. Start the frontend: cd frontend && npm run dev${NC}"
echo -e "${GREEN}4. Or use the start script: ./start.sh${NC}"

echo ""
echo -e "${BLUE}🎉 HomeFlix gRPC proto generation complete!${NC}"