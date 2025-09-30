export function cleanMovieTitle(title: string | undefined | null): string {
  // Handle null/undefined titles
  if (!title || typeof title !== 'string') {
    return 'Unknown Movie';
  }
  
  // Remove garbage characters from recycle bin files
  if (title.startsWith('$') && title.length < 10 && /^[$][A-Z0-9]+$/.test(title)) {
    return 'Unknown Movie';
  }
  
  // Remove technical prefixes like "225142-125470-"
  let cleaned = title.replace(/^\d+-\d+-/, '');
  
  // Remove file extensions and quality indicators
  cleaned = cleaned.replace(/\.(mkv|mp4|avi|mov|wmv|flv|webm)$/i, '');
  cleaned = cleaned.replace(/\s*\(?\d{3,4}p\)?$/i, '');
  cleaned = cleaned.replace(/\s*\[.*?\]$/g, '');
  cleaned = cleaned.replace(/\s*\(.*?Collection.*?\)/gi, '');
  
  // Clean up common patterns and encoding info
  cleaned = cleaned.replace(/BrRip|BRRip|WEB-DL|HEVC|x264|x265|YIFY|AAC|DTS|AC3|BluRay|DVDRip|HDRip/gi, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Extract year if present and clean format
  const yearMatch = cleaned.match(/^(.*?)\s*\((\d{4})\)(.*)$/);
  if (yearMatch) {
    const [, movieName, year, extra] = yearMatch;
    return `${movieName.trim()} (${year})`;
  }
  
  return cleaned || 'Unknown Movie';
}

export function extractNiceTitle(title: string | undefined | null): string {
  const cleaned = cleanMovieTitle(title);
  
  // Handle episode formats like "S01E01" or "Season 1 Episode 1"
  const episodeMatch = cleaned.match(/^(.*?)\s*[Ss](\d+)[Ee](\d+)(.*)$/);
  if (episodeMatch) {
    const [, showName, season, episode, extra] = episodeMatch;
    return `${showName.trim()} - Season ${parseInt(season)} Episode ${parseInt(episode)}`;
  }
  
  // Handle season formats like "Season 1" or "S01"
  const seasonMatch = cleaned.match(/^(.*?)\s*[Ss]eason\s*(\d+)(.*)$/i);
  if (seasonMatch) {
    const [, showName, season, extra] = seasonMatch;
    return `${showName.trim()} - Season ${parseInt(season)}`;
  }
  
  // Handle simple S01 format
  const simpleSeasonMatch = cleaned.match(/^(.*?)\s*[Ss](\d+)(.*)$/);
  if (simpleSeasonMatch) {
    const [, showName, season, extra] = simpleSeasonMatch;
    return `${showName.trim()} - Season ${parseInt(season)}`;
  }
  
  // Add proper spacing for camelCase or PascalCase titles
  let spaced = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2');
  
  // Add spaces before numbers that follow letters
  spaced = spaced.replace(/([a-zA-Z])(\d)/g, '$1 $2');
  
  // Add spaces after numbers that precede letters
  spaced = spaced.replace(/(\d)([a-zA-Z])/g, '$1 $2');
  
  // Clean up multiple spaces
  spaced = spaced.replace(/\s+/g, ' ').trim();
  
  // Capitalize first letter of each word for better presentation
  return spaced.replace(/\b\w/g, l => l.toUpperCase());
}

export function isSingleWordTitle(title: string | undefined | null): boolean {
  if (!title || typeof title !== 'string') {
    return false;
  }
  
  const cleaned = extractNiceTitle(title);
  // Remove common words and check if it's essentially one main word
  const words = cleaned.split(' ').filter(word => 
    word.length > 2 && 
    !['The', 'A', 'An', 'Of', 'In', 'On', 'At', 'To', 'For', 'With', 'By'].includes(word)
  );
  
  return words.length === 1;
}

export function extractMovieYear(title: string | undefined | null): number | null {
  if (!title || typeof title !== 'string') {
    return null;
  }
  const yearMatch = title.match(/\((\d{4})\)/);
  return yearMatch ? parseInt(yearMatch[1]) : null;
}

export function getMovieGenre(title: string | undefined | null, description?: string): string[] {
  if (!title || typeof title !== 'string') {
    return ['Drama'];
  }
  const lowerTitle = title.toLowerCase();
  const lowerDesc = description?.toLowerCase() || '';
  
  const genres: string[] = [];
  
  // Genre detection based on title and description
  if (lowerTitle.includes('drama') || lowerDesc.includes('drama')) genres.push('Drama');
  if (lowerTitle.includes('action') || lowerDesc.includes('action')) genres.push('Action');
  if (lowerTitle.includes('comedy') || lowerDesc.includes('comedy')) genres.push('Comedy');
  if (lowerTitle.includes('horror') || lowerDesc.includes('horror')) genres.push('Horror');
  if (lowerTitle.includes('thriller') || lowerDesc.includes('thriller')) genres.push('Thriller');
  if (lowerTitle.includes('romance') || lowerDesc.includes('romance')) genres.push('Romance');
  if (lowerTitle.includes('sci-fi') || lowerDesc.includes('science fiction')) genres.push('Sci-Fi');
  if (lowerTitle.includes('fantasy') || lowerDesc.includes('fantasy')) genres.push('Fantasy');
  if (lowerTitle.includes('documentary') || lowerDesc.includes('documentary')) genres.push('Documentary');
  if (lowerTitle.includes('animation') || lowerDesc.includes('animated')) genres.push('Animation');
  
  return genres.length > 0 ? genres : ['Drama'];
}

export function findSimilarMovies(currentTitle: string | undefined | null, allMovies: any[], limit: number = 6): any[] {
  if (!currentTitle || typeof currentTitle !== 'string') {
    return allMovies.slice(0, limit);
  }
  const cleanedCurrent = cleanMovieTitle(currentTitle).toLowerCase();
  const currentYear = extractMovieYear(currentTitle);
  
  return allMovies
    .filter(movie => movie.title !== currentTitle)
    .map(movie => ({
      ...movie,
      similarity: calculateSimilarity(cleanedCurrent, currentYear, movie)
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

function calculateSimilarity(currentTitle: string, currentYear: number | null, movie: any): number {
  const movieTitle = cleanMovieTitle(movie.title).toLowerCase();
  const movieYear = extractMovieYear(movie.title);
  
  let score = 0;
  
  // Genre similarity
  if (movie.genres && movie.genres.length > 0) {
    score += 2;
  }
  
  // Year proximity
  if (currentYear && movieYear) {
    const yearDiff = Math.abs(currentYear - movieYear);
    if (yearDiff <= 2) score += 3;
    else if (yearDiff <= 5) score += 2;
    else if (yearDiff <= 10) score += 1;
  }
  
  // Title word similarity
  const currentWords = currentTitle.split(' ');
  const movieWords = movieTitle.split(' ');
  const commonWords = currentWords.filter(word => 
    word.length > 3 && movieWords.some(mWord => mWord.includes(word) || word.includes(mWord))
  );
  score += commonWords.length * 2;
  
  // Rating bonus
  if (movie.rating && movie.rating >= 7) score += 1;
  
  return score;
}
