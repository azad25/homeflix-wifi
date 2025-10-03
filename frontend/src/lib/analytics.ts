// Analytics utility functions for tracking user interactions
export interface AnalyticsEvent {
  event: string;
  category: string;
  action: string;
  label?: string;
  value?: number;
  userId?: string;
  mediaId?: string;
  timestamp?: Date;
}

// Track click events
export const trackClick = (element: string, mediaId?: string, additionalData?: any) => {
  const event: AnalyticsEvent = {
    event: 'click',
    category: 'user_interaction',
    action: 'click',
    label: element,
    mediaId,
    timestamp: new Date(),
    ...additionalData
  };
  
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Analytics Event:', event);
  }
  
  // In production, this would send to analytics service
  // Example: sendToAnalytics(event);
};

// Track media play events
export const trackPlay = (mediaId: string, mediaTitle?: string) => {
  trackClick('play_button', mediaId, {
    category: 'media_interaction',
    action: 'play',
    label: mediaTitle
  });
};

// Track media info events
export const trackInfo = (mediaId: string, mediaTitle?: string) => {
  trackClick('info_button', mediaId, {
    category: 'media_interaction',
    action: 'info',
    label: mediaTitle
  });
};

// Track page views
export const trackPageView = (page: string) => {
  const event: AnalyticsEvent = {
    event: 'page_view',
    category: 'navigation',
    action: 'view',
    label: page,
    timestamp: new Date()
  };
  
  if (process.env.NODE_ENV === 'development') {
    console.log('Page View:', event);
  }
};

// Track search events
export const trackSearch = (query: string, resultsCount?: number) => {
  const event: AnalyticsEvent = {
    event: 'search',
    category: 'search',
    action: 'query',
    label: query,
    value: resultsCount,
    timestamp: new Date()
  };
  
  if (process.env.NODE_ENV === 'development') {
    console.log('Search Event:', event);
  }
};

// Track video progress
export const trackVideoProgress = (mediaId: string, progress: number, duration: number) => {
  const event: AnalyticsEvent = {
    event: 'video_progress',
    category: 'media_interaction',
    action: 'progress',
    mediaId,
    value: Math.round((progress / duration) * 100),
    timestamp: new Date()
  };
  
  if (process.env.NODE_ENV === 'development') {
    console.log('Video Progress:', event);
  }
};

// Helper function to send events to analytics service
const sendToAnalytics = (event: AnalyticsEvent) => {
  // This would integrate with your analytics service
  // Example: Google Analytics, Mixpanel, etc.
  console.log('Sending to analytics:', event);
};
