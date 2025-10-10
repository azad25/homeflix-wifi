// Request throttling and debouncing utilities for API optimization

interface ThrottleConfig {
  maxRequests: number;
  timeWindow: number;
  maxConcurrent: number;
}

class RequestThrottler {
  private requestCounts = new Map<string, number[]>();
  private concurrentRequests = new Map<string, number>();
  private globalConcurrentCount = 0;
  private readonly maxGlobalConcurrent = 10;

  private defaultConfig: ThrottleConfig = {
    maxRequests: 15,
    timeWindow: 60000,
    maxConcurrent: 3
  };

  private endpointConfigs = new Map<string, ThrottleConfig>([
    ['recommendations', { maxRequests: 5, timeWindow: 60000, maxConcurrent: 1 }],
    ['media', { maxRequests: 20, timeWindow: 60000, maxConcurrent: 5 }],
    ['assets', { maxRequests: 50, timeWindow: 60000, maxConcurrent: 8 }],
    ['search', { maxRequests: 10, timeWindow: 60000, maxConcurrent: 2 }]
  ]);

  private getConfig(endpoint: string): ThrottleConfig {
    return this.endpointConfigs.get(endpoint) || this.defaultConfig;
  }

  private cleanupOldRequests(endpoint: string, timeWindow: number): void {
    const now = Date.now();
    const requests = this.requestCounts.get(endpoint) || [];
    const validRequests = requests.filter(timestamp => now - timestamp < timeWindow);
    this.requestCounts.set(endpoint, validRequests);
  }

  private canMakeRequest(endpoint: string): boolean {
    const config = this.getConfig(endpoint);
    this.cleanupOldRequests(endpoint, config.timeWindow);
    
    const requestCount = this.requestCounts.get(endpoint)?.length || 0;
    const concurrentCount = this.concurrentRequests.get(endpoint) || 0;
    
    return requestCount < config.maxRequests && 
           concurrentCount < config.maxConcurrent && 
           this.globalConcurrentCount < this.maxGlobalConcurrent;
  }

  private recordRequest(endpoint: string): void {
    const now = Date.now();
    const requests = this.requestCounts.get(endpoint) || [];
    requests.push(now);
    this.requestCounts.set(endpoint, requests);
    
    const concurrent = this.concurrentRequests.get(endpoint) || 0;
    this.concurrentRequests.set(endpoint, concurrent + 1);
    this.globalConcurrentCount++;
  }

  private releaseRequest(endpoint: string): void {
    const concurrent = this.concurrentRequests.get(endpoint) || 0;
    this.concurrentRequests.set(endpoint, Math.max(0, concurrent - 1));
    this.globalConcurrentCount = Math.max(0, this.globalConcurrentCount - 1);
  }

  throttle<T>(
    fn: (...args: any[]) => Promise<T>,
    endpoint: string,
    delay: number = 0
  ): (...args: any[]) => Promise<T> {
    return async (...args: any[]): Promise<T> => {
      if (!this.canMakeRequest(endpoint)) {
        console.log(`🚦 Throttling request to ${endpoint}, waiting...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.throttle(fn, endpoint, delay)(...args);
      }

      this.recordRequest(endpoint);
      
      try {
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        const result = await fn(...args);
        console.log(`✅ Request to ${endpoint} completed successfully`);
        return result;
      } catch (error) {
        console.error(`❌ Request to ${endpoint} failed:`, error);
        throw error;
      } finally {
        this.releaseRequest(endpoint);
      }
    };
  }

  debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => Promise<ReturnType<T>> {
    let timeoutId: NodeJS.Timeout;

    return (...args: Parameters<T>): Promise<ReturnType<T>> => {
      return new Promise((resolve, reject) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(async () => {
          try {
            const result = await func(...args);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }, delay);
      });
    };
  }

  getStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [endpoint] of this.requestCounts.entries()) {
      const config = this.getConfig(endpoint);
      this.cleanupOldRequests(endpoint, config.timeWindow);
      
      stats[endpoint] = {
        requestCount: this.requestCounts.get(endpoint)?.length || 0,
        maxRequests: config.maxRequests,
        concurrentRequests: this.concurrentRequests.get(endpoint) || 0,
        maxConcurrent: config.maxConcurrent
      };
    }
    
    stats.global = {
      concurrentRequests: this.globalConcurrentCount,
      maxConcurrent: this.maxGlobalConcurrent
    };
    
    return stats;
  }
}

class AssetLoader {
  private queue: Array<{
    url: string;
    priority: 'high' | 'medium' | 'low';
    type: 'image' | 'video' | 'audio';
    resolve: (result: any) => void;
    reject: (error: any) => void;
    timestamp: number;
  }> = [];
  private loading = new Set<string>();
  private maxConcurrent = 4;
  private currentLoading = 0;

  load(
    url: string,
    type: 'image' | 'video' | 'audio' = 'image',
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        url,
        priority,
        type,
        resolve,
        reject,
        timestamp: Date.now()
      });
      
      this.processQueue();
    });
  }

  private processQueue(): void {
    if (this.currentLoading >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const request = this.queue.shift();
    if (!request) return;

    if (this.loading.has(request.url)) {
      this.processQueue();
      return;
    }

    this.loading.add(request.url);
    this.currentLoading++;

    this.loadAsset(request)
      .then(result => request.resolve(result))
      .catch(error => request.reject(error))
      .finally(() => {
        this.loading.delete(request.url);
        this.currentLoading--;
        this.processQueue();
      });
  }

  private async loadAsset(request: any): Promise<any> {
    const { url, type } = request;
    
    switch (type) {
      case 'image':
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = url;
        });
      
      case 'video':
        return new Promise((resolve, reject) => {
          const video = document.createElement('video');
          video.onloadeddata = () => resolve(video);
          video.onerror = reject;
          video.preload = 'metadata';
          video.src = url;
        });
      
      default:
        return fetch(url);
    }
  }

  getStats() {
    return {
      queueLength: this.queue.length,
      currentLoading: this.currentLoading,
      maxConcurrent: this.maxConcurrent,
      loadingUrls: Array.from(this.loading)
    };
  }
}

export const requestThrottler = new RequestThrottler();
export const assetLoader = new AssetLoader();
