export function cleanMovieTitle(title: string): string {
  // Remove garbage characters from recycle bin files
  if (title.startsWith('$') && title.length < 10 && /^[$][A-Z0-9]+$/.test(title)) {
    return 'Unknown Movie';
  }
  
  // Remove technical prefixes like "225142-125470-"
  let cleaned = title.replace(/^\d+-\d+-/, '');
  
  // Remove file extensions and quality indicators
  cleaned = cleaned.replace(/\.(mkv|mp4|avi|mov)$/i, '');
  cleaned = cleaned.replace(/\s*\(?\d{3,4}p\)?$/i, '');
  cleaned = cleaned.replace(/\s*\[.*?\]$/g, '');
  cleaned = cleaned.replace(/\s*\(.*?Collection.*?\)/gi, '');
  
  // Clean up common patterns
  cleaned = cleaned.replace(/BrRip|BRRip|WEB-DL|HEVC|x264|YIFY|AAC/gi, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Remove year if present - we don't want years in slide titles
  const yearMatch = cleaned.match(/^(.*?)\s*\((\d{4})\)(.*)$/);
  if (yearMatch) {
    const [, movieName, , extra] = yearMatch;
    return `${movieName.trim()}${extra ? ' ' + extra.trim() : ''}`;
  }
  
  return cleaned || 'Unknown Movie';
}

export function extractMovieYear(title: string): number | null {
  const yearMatch = title.match(/\((\d{4})\)/);
  return yearMatch ? parseInt(yearMatch[1]) : null;
}

export function getMovieGenre(title: string, description?: string): string[] {
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

export function findSimilarMovies(currentTitle: string, allMovies: any[], limit: number = 6): any[] {
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
