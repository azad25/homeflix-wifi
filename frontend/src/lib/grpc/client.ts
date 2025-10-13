// HomeFlix gRPC Client Helper
// Using HTTP fallback for immediate functionality, gRPC-Web can be added later

// API endpoints
const GRPC_WEB_ENDPOINT = process.env.NEXT_PUBLIC_GRPC_WEB_URL || 'http://localhost:8253';
const HTTP_API_ENDPOINT = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8252';

// gRPC channel placeholder (for future gRPC-Web implementation)
export const grpcChannel = {
  endpoint: GRPC_WEB_ENDPOINT,
  isConnected: false,
};

// Helper function to create gRPC clients (placeholder)
export function createGrpcClient<T>(serviceDefinition: any): T {
  // For now, return a mock client that uses HTTP fallback
  return {} as T;
}

// HTTP fallback client for immediate functionality
export class HttpFallbackClient {
  private baseUrl: string;

  constructor(baseUrl: string = HTTP_API_ENDPOINT) {
    this.baseUrl = baseUrl;
  }

  async get(path: string, params?: Record<string, any>) {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  async post(path: string, data?: any) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  async stream(path: string, params?: Record<string, any>) {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    return fetch(url.toString());
  }
}

// Default HTTP client instance
export const httpClient = new HttpFallbackClient();

// Connection health check
export async function checkGrpcConnection(): Promise<boolean> {
  try {
    // Check if gRPC-Web proxy is available on port 8252
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${GRPC_WEB_ENDPOINT}/health`, { 
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.warn('gRPC connection not available, using HTTP fallback:', error);
    return false;
  }
}

// Check if HTTP API is available
export async function checkHttpConnection(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${HTTP_API_ENDPOINT}/api/health`, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.error('HTTP API connection failed:', error);
    return false;
  }
}
