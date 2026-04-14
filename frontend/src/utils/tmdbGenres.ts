export const TMDB_GENRES: { [key: number]: string } = {
    28: "Action",
    12: "Adventure",
    16: "Animation",
    35: "Comedy",
    80: "Crime",
    99: "Documentary",
    18: "Drama",
    10751: "Family",
    14: "Fantasy",
    36: "History",
    27: "Horror",
    10402: "Music",
    9648: "Mystery",
    10749: "Romance",
    878: "Sci-Fi",
    10770: "TV Movie",
    53: "Thriller",
    10752: "War",
    37: "Western"
};

export const getTMDBGenreNames = (genreIds?: number[] | null): string[] => {
    if (!genreIds || !Array.isArray(genreIds)) return [];
    return genreIds.map(id => TMDB_GENRES[id]).filter(Boolean);
};

export const getRobustGenres = (mediaItem: any): string[] => {
    if (!mediaItem) return [];
    if (mediaItem.genre_names && mediaItem.genre_names.length > 0) return mediaItem.genre_names;
    if (mediaItem.genres && mediaItem.genres.length > 0) return mediaItem.genres.map((g: any) => g.name || g);
    if (mediaItem.genre_ids && mediaItem.genre_ids.length > 0) return getTMDBGenreNames(mediaItem.genre_ids);
    return [];
};
