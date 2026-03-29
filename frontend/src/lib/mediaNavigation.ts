import { Media } from '@/types/media';

export const resolveMediaRoute = (media: Media): string => {
    const rawSourceType = (media as unknown as { source_type?: string }).source_type;
    const sourceType = typeof rawSourceType === 'string' ? rawSourceType.toLowerCase() : undefined;
    const isLocal = Boolean((media as unknown as { is_local?: boolean }).is_local);
    const isSeriesType = media.type === 'episode' || media.type === 'tv' || media.type === 'series';
    const tmdbMediaType = media.media_type === 'tv' || media.type === 'tv' || media.type === 'series' || media.type === 'episode' ? 'tv' : 'movie';
    const hasLocalId = typeof media.id === 'number';
    const hasTMDBId = typeof media.tmdb_id === 'number' && media.tmdb_id > 0;

    const hasLocalFile = !!(media.file_path || (media as any).path);
    const isExplicitTMDB = sourceType === 'tmdb';
    const isExplicitLocal = sourceType === 'local' || isLocal;
    const shouldUseTMDB = isExplicitTMDB || (hasTMDBId && !hasLocalFile && !isExplicitLocal);

    if (isSeriesType) {
        if (shouldUseTMDB && hasTMDBId) {
            return `/tmdb-movie/${media.tmdb_id}?type=tv`;
        }
        const seriesId = media.series_id || media.id;
        return `/tv-series/${seriesId}`;
    }

    if (sourceType === 'local' && hasLocalId) {
        return `/movie/${media.id}`;
    }
    
    if (isExplicitTMDB && hasTMDBId) {
        return `/tmdb-movie/${media.tmdb_id}?type=${tmdbMediaType}`;
    }

    if (hasLocalFile && hasLocalId) {
        return `/movie/${media.id}`;
    }

    if (hasTMDBId && !hasLocalFile && !isExplicitLocal) {
        return `/tmdb-movie/${media.tmdb_id}?type=${tmdbMediaType}`;
    }

    if (hasLocalId) {
        return `/movie/${media.id}`;
    }

    return '/';
};

export const navigateToMedia = (navigate: { push: (href: string) => void }, media: Media) => {
    const route = resolveMediaRoute(media);
    navigate.push(route);
};
