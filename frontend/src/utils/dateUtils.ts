import { Media } from '../types/media';

export const isComingSoon = (item: Media): boolean => {
    const dateStr = item.release_date || item.first_air_date;
    if (!dateStr || dateStr.trim() === '') return false;
    
    // Parse the date
    const releaseDate = new Date(dateStr);
    if (isNaN(releaseDate.getTime())) return false;
    
    // Compare with today (ignoring time)
    const today = new Date();
    releaseDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    return releaseDate > today;
};

export const getYear = (item: any): number | null => {
    if (!item) return null;
    
    if (item.year) {
        const y = Number(item.year);
        if (!isNaN(y) && y > 1900) return y;
    }
    
    const getYearFromDate = (dateVal: any) => {
        if (!dateVal) return null;
        if (typeof dateVal === 'string') {
            // First try basic YYYY extraction
            const parsed = parseInt(dateVal.substring(0, 4), 10);
            if (!isNaN(parsed) && parsed > 1900) return parsed;
            // Fallback to JS Date parser
            const d = new Date(dateVal);
            if (!isNaN(d.getTime())) return d.getFullYear();
        }
        if (dateVal instanceof Date) return dateVal.getFullYear();
        return null;
    };

    const rdYear = getYearFromDate(item.release_date);
    if (rdYear) return rdYear;
    
    const fadYear = getYearFromDate(item.first_air_date);
    if (fadYear) return fadYear;

    return null;
};
