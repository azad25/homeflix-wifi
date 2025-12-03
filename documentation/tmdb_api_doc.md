### TMDB Discover API – Full Guide (2025)

The **Discover** endpoint is the most powerful way to get filtered and sorted lists of movies or TV shows on TMDB.

Official endpoint:  
`GET https://api.themoviedb.org/3/discover/movie`  
`GET https://api.themoviedb.org/3/discover/tv`

It lets you combine dozens of filters (genre, year, rating, cast, keywords, streaming providers, etc.) and sort results exactly how you want.

#### Base URL
```
https://api.themoviedb.org/3/discover/movie?api_key=YOUR_API_KEY
```
or with Bearer token (recommended):
```http
Authorization: Bearer YOUR_READ_ACCESS_TOKEN
```

#### Most Useful Parameters (Movie Discover)

| Parameter                        | Example Value                  | Description |
|----------------------------------|-------------------------------|-------------------------------------------------------------|
| `language`                       | en-US                         | Language of titles/overviews                                |
| `region`                         | US                            | Affects release dates and certification                     |
| `sort_by`                        | popularity.desc               | See full list below                                         |
| `page`include_adult                 | false                         | Include adult titles                                        |
| `include_video`                  | false                         | Include video results                                       |
| `page`                           | 1                             | Pagination (max 500 pages)                                  |
| `primary_release_year`           | 2025                          | Exact year                                                  |
| `primary_release_date.gte`       | 2025-01-01                    | Release date ≥                                              |
| `primary_release_date.lte`       | 2025-12-31                    | Release date ≤                                              |
| `release_date.gte` / `lte`       |                               | Uses theatrical + digital dates (more accurate for streaming) |
| `with_genres`                    | 28,12                         | Genre IDs (comma-separated, AND logic)                      |
| `without_genres`                 | 16                            | Exclude animation                                           |
| `with_cast`                      | 287,976                         | Actor IDs (Tom Hardy + Zendaya)                             |
| `with_crew`                      | 12345                         | Director/crew ID                                            |
| `with_people`                    | 287                           | Any role (cast or crew)                                     |
| `with_companies`                 | 420                           | Production company (e.g., Marvel Studios)                   |
| `with_keywords`                  | 210024\|180547                | Keyword IDs (pipe = OR, comma = AND)                        |
| `vote_average.gte`               | 7.5                           | Minimum average rating                                      |
| `vote_count.gte`                 | 300                           | Minimum number of votes                                     |
| `with_runtime.gte` / `lte`       | 90 / 180                      | Runtime in minutes                                          |
| `watch_region`                   | US                            | For watch providers                                         |
| `with_watch_providers`           | 8\|337                        | Netflix \| Disney+ (pipe = OR)                              |
| `with_watch_monetization_types`  | flatrate\|buy                 | Only streaming, or include buy/rent                          |
| `certification_country`          | US                            |                                                             |
| `certification`                  | R                             | Only R-rated movies                                         |
| `certification.lte`              | PG-13                         |                                                             |

#### Popular sort_by Options
```
popularity.desc
popularity.asc
vote_average.desc
vote_average.asc
primary_release_date.desc      newest first
primary_release_date.asc
revenue.desc
original_title.asc
```

#### Real-World Example URLs (2025)

1. **New popular movies in theaters right now (US)**
   ```
   https://api.themoviedb.org/3/discover/movie?
   api_key=xxx
   &region=US
   &primary_release_date.gte=2025-11-01
   &primary_release_date.lte=2025-12-31
   &sort_by=popularity.desc
   &vote_count.gte=50
   ```

2. **Best rated movies of 2025 on Netflix or Disney+ (≥ 8.0, ≥ 500 votes)**
   ```
   https://api.themoviedb.org/3/discover/movie?
   api_key=xxx
   &primary_release_year=2025
   &with_watch_providers=8|337
   &watch_region=US
   &vote_average.gte=8.0
   &vote_count.gte=500
   &sort_by=vote_average.desc
   ```

3. **Sci-fi action movies with Christopher Nolan OR Denis Villeneuve**
   ```
   https://api.themoviedb.org/3/discover/movie?
   api_key=xxx
   &with_genres=878,28
   &with_people=525,137427
   &sort_by=primary_release_date.desc
   ```

#### How to Get IDs You Need
- Genres → `GET /genre/movie/list`
- Person ID → `GET /search/person?query=Christopher+Nolan`
- Keyword ID → `GET /search/keyword?query=time+travel`
- Watch providers → `GET /watch/providers/movie?watch_region=US`

#### Quick Code Examples

**JavaScript (fetch)**
```javascript
const url = new URL("https://api.themoviedb.org/3/discover/movie");
url.searchParams.append('api_key', 'YOUR_API_KEY');
url.searchParams.append('sort_by', 'vote_average.desc');
url.searchParams.append('vote_count.gte', '1000');
url.searchParams.append('primary_release_year', '2025');
url.searchParams.append('with_genres', '18'); // Drama

fetch(url)
  .then(r => r.json())
  .then(data => console.log(data));
```

**Python (requests)**
```python
import requests

params = {
    'api_key': 'YOUR_API_KEY',
    'sort_by': 'popularity.desc',
    'primary_release_date.gte': '2025-01-01',
    'with_watch_providers': '8|337',
    'watch_region': 'US',
    'page': 1
}

response = requests.get('https://api.themoviedb.org/3/discover/movie', params=params)
movies = response.json()
```

Full documentation:  
https://developer.themoviedb.org/reference/discover-movie

No, the list I provided earlier isn't exhaustive—TMDB's movie API has a few more specialized endpoints, particularly in areas like certifications, append-to-response (which bundles multiple calls), and multi-language/multi-region data. I've cross-referenced the official documentation to compile a more complete overview below.

This is based on the v3 API as of December 2025. Endpoints are grouped by category for clarity. All use the base URL `https://api.themoviedb.org/3` and require authentication (API key or bearer token).

### Core Movie Details
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/movie/{movie_id}` | GET | Primary movie details (title, overview, ratings, etc.) |
| `/movie/{movie_id}/account_states` | GET | User's personal ratings, watchlist, and favorite status for the movie |
| `/movie/{movie_id}/alternative_titles` | GET | Alternative titles in different countries/languages |
| `/movie/{movie_id}/changes` | GET | Recent changes to the movie's data (paginated) |
| `/movie/{movie_id}/credits` | GET | Full cast and crew credits |
| `/movie/{movie_id}/external_ids` | GET | External IDs (e.g., IMDb, TVMaze) |
| `/movie/{movie_id}/images` | GET | Posters, backdrops, and logos (paginated) |
| `/movie/{movie_id}/keywords` | GET | Keywords and tags associated with the movie |
| `/movie/{movie_id}/lists` | GET | User lists that include this movie (paginated) |
| `/movie/{movie_id}/recommendations` | GET | Similar/recommended movies (paginated) |
| `/movie/{movie_id}/release_dates` | GET | Release dates and certifications by country |
| `/movie/{movie_id}/reviews` | GET | User reviews (paginated) |
| `/movie/{movie_id}/similar` | GET | Similar movies (paginated) |
| `/movie/{movie_id}/translations` | GET | Translated titles and overviews |
| `/movie/{movie_id}/videos` | GET | Trailers and clips (YouTube/Vimeo links) |
| `/movie/{movie_id}/watch/providers` | GET | Streaming/rental providers by region |

### Aggregated & Advanced Details
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/movie/{movie_id}/aggregate_credits` | GET | Combined cast/crew credits across all languages/regions |
| `/movie/{movie_id}/certifications` | GET | **New/Additional**: Movie certifications (e.g., PG-13) available for specific countries |
| `/movie/{movie_id}/group_list` | GET | **New/Additional**: Groups of related items (e.g., franchise parts) |

### Lists & Collections
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/movie/latest` | GET | The most recently added movie to the database |
| `/movie/now_playing` | GET | Movies currently in theaters (paginated) |
| `/movie/popular` | GET | Currently popular movies (paginated) |
| `/movie/top_rated` | GET | Highest-rated movies (paginated) |
| `/movie/upcoming` | GET | Upcoming releases (paginated) |
| `/collection/{collection_id}` | GET | Details for a movie collection (e.g., "The Avengers" series) |
| `/collection/{collection_id}/images` | GET | **New/Additional**: Images specific to the collection |

### Discovery & Search
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/discover/movie` | GET | Advanced filtered/sorted movie discovery |
| `/search/movie` | GET | Basic search for movies by query |

### Supporting Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/genre/movie/list` | GET | List of all movie genres with IDs |
| `/trending/movie/{time_window}` | GET | Trending movies (time_window: day or week) |
| `/watch/providers/movie` | GET | Available streaming providers (filterable by region) |
| `/movie/{movie_id}?append_to_response=credits,images,videos` | GET | **New/Additional**: Append multiple sub-resources to a single movie details call (e.g., credits + videos in one request) for efficiency |

### Notes
- **Completeness**: This now covers **all** documented movie-specific endpoints in TMDB v3. There are no major additions beyond what I listed before, but I've included a few niche ones like `/movie/{movie_id}/certifications` and the `append_to_response` parameter (which isn't a separate endpoint but a powerful feature on `/movie/{movie_id}`).
- **Production Companies**: Not a dedicated endpoint—it's embedded in `/movie/{movie_id}` under the `production_companies` array.
- **Rate Limits**: Still 40 requests/10 seconds. Use `append_to_response` to minimize calls.
- **Multi-Language**: Most endpoints support `language` param for localization.

For the absolute latest (in case of undocumented changes), check the official docs directly: [TMDB Movie Reference](https://developer.themoviedb.org/reference/movie-module). If you meant something specific by "these" or want examples for any endpoint, let me know!