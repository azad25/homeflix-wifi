// SAFE ASSET UTILITIES - Prevents CORS errors by returning placeholders instead of making API calls

const PLACEHOLDER_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDMwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDAwIiBmaWxsPSJncmFkaWVudChsaW5lYXIsIDQ1ZGVnLCAjMTExLCAjMzMzKSIvPgo8dGV4dCB4PSIxNTAiIHk9IjIwMCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjI0IiBmaWxsPSIjZTUwOTE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Ib21lRmxpeDwvdGV4dD4KPHN2Zz4=';

const PLACEHOLDER_WIDE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiB2aWV3Qm94PSIwIDAgMTkyMCAxMDgwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiBmaWxsPSIjMTExMTExIi8+CjxwYXRoIGQ9Ik05NjAgNTQwTDEwODAgNDIwVjY2MEw5NjAgNTQwWiIgZmlsbD0iIzMzMzMzMyIvPgo8L3N2Zz4K';

// DISABLED: Safe asset URL generators - return placeholders to prevent CORS errors (silent mode)
export const getSafeThumbnailUrl = (mediaId: number | string): string => {
  // Silent mode - no console warnings to reduce log noise
  return PLACEHOLDER_IMAGE;
};

export const getSafePosterUrl = (mediaId: number | string): string => {
  // Silent mode - no console warnings to reduce log noise
  return PLACEHOLDER_IMAGE;
};

export const getSafePreviewUrl = (mediaId: number | string): string => {
  // Silent mode - no console warnings to reduce log noise
  return PLACEHOLDER_WIDE;
};

export const getSafeBackgroundUrl = (mediaId: number | string): string => {
  // Silent mode - no console warnings to reduce log noise
  return PLACEHOLDER_WIDE;
};

// DISABLED: Safe fallback URL arrays - return placeholders to prevent CORS errors (silent mode)
export const getSafeFallbackUrls = (mediaId: number | string): string[] => {
  // Silent mode - no console warnings to reduce log noise
  return [PLACEHOLDER_IMAGE, PLACEHOLDER_IMAGE, PLACEHOLDER_IMAGE];
};

// DISABLED: Safe image loading with error handling - return placeholder immediately (silent mode)
export const loadSafeImage = async (url: string): Promise<string> => {
  // Silent mode - no console warnings to reduce log noise
  return Promise.resolve(PLACEHOLDER_IMAGE);
};

// Media type detection for appropriate placeholder
export const getPlaceholderForMediaType = (type?: string): string => {
  if (type === 'episode' || type === 'tv') {
    return PLACEHOLDER_WIDE; // Episodes typically use wide thumbnails
  }
  return PLACEHOLDER_IMAGE; // Movies use poster format
};

// Safe asset URL with media type awareness (silent mode)
export const getSafeAssetUrl = (
  assetType: 'thumbnail' | 'poster' | 'preview' | 'background',
  mediaId: number | string,
  mediaType?: string
): string => {
  // Silent mode - no console warnings to reduce log noise
  
  if (assetType === 'preview' || assetType === 'background') {
    return PLACEHOLDER_WIDE;
  }
  
  return getPlaceholderForMediaType(mediaType);
};

// Disable all asset preloading (silent mode)
export const disableAssetPreloading = () => {
  // Silent mode - no console warnings to reduce log noise
  return Promise.resolve([]);
};

export default {
  getSafeThumbnailUrl,
  getSafePosterUrl,
  getSafePreviewUrl,
  getSafeBackgroundUrl,
  getSafeFallbackUrls,
  loadSafeImage,
  getPlaceholderForMediaType,
  getSafeAssetUrl,
  disableAssetPreloading
};
