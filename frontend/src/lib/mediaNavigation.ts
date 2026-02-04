import { Media } from '@/types/media';

export const resolveMediaRoute = (media: Media): string => {
    const rawSourceType = (media as unknown as { source_type?: string }).source_type;
    const sourceType = typeof rawSourceType === 'string' ? rawSourceType.toLowerCase() : undefined;
    const isSeriesType = media.type === 'episode' || media.type === 'tv' || media.type === 'series';
    const hasLocalId = typeof media.id === 'number';
    const hasTMDBId = typeof media.tmdb_id === 'number' && media.tmdb_id > 0;
    
    // Check if this is local content with a file
    const hasLocalFile = !!(media.file_path || (media as any).path);

    if (isSeriesType) {
        const seriesId = media.series_id || media.id;
        return `/tv-series/${seriesId}`;
    }

    // Priority 1: Explicit source_type
    if (sourceType === 'local' && hasLocalId) {
        return `/movie/${media.id}`;
    }
    
    if (sourceType === 'tmdb' && hasTMDBId) {
        const mediaType = isSeriesType ? 'tv' : 'movie';
        return `/tmdb-movie/${media.tmdb_id}?type=${mediaType}`;
    }

    // Priority 2: Has local file = local content
    if (hasLocalFile && hasLocalId) {
        return `/movie/${media.id}`;
    }

    // Priority 3: Has TMDB ID but no local file = TMDB content
    if (hasTMDBId && !hasLocalFile) {
        const mediaType = isSeriesType ? 'tv' : 'movie';
        return `/tmdb-movie/${media.tmdb_id}?type=${mediaType}`;
    }

    // Priority 4: Has local ID = local content
    if (hasLocalId) {
        return `/movie/${media.id}`;
    }

    return '/';
};

export const navigateToMedia = (navigate: { push: (href: string) => void }, media: Media) => {
    const route = resolveMediaRoute(media);
    navigate.push(route);
};
