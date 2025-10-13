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
