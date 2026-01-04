import { Media } from '@/types/media';

export const resolveMediaRoute = (media: Media): string => {
    const rawSourceType = (media as unknown as { source_type?: string }).source_type;
    const sourceType = typeof rawSourceType === 'string' ? rawSourceType.toLowerCase() : undefined;
    const isSeriesType = media.type === 'episode' || media.type === 'tv' || media.type === 'series';
    const hasLocalId = typeof media.id === 'number';
    const idsMatchTMDB = typeof media.tmdb_id === 'number' && media.tmdb_id === media.id;

    if (isSeriesType) {
        const seriesId = media.series_id || media.id;
        return `/tv-series/${seriesId}`;
    }

    const isLocal = sourceType === 'local' || (!media.tmdb_id && hasLocalId);
    const isTMDB = sourceType === 'tmdb' || (!!media.tmdb_id && !isLocal);

    if (isLocal && hasLocalId) {
        return `/movie/${media.id}`;
    }

    if (isTMDB && media.tmdb_id) {
        const mediaType = isSeriesType ? 'tv' : 'movie';
        return `/tmdb-movie/${media.tmdb_id}?type=${mediaType}`;
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
