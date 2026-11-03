# Coming Soon

HomeFlix keeps a lineup of the **10 most anticipated upcoming movies and 10
series** (releasing this year or next), each with its trailer downloaded and
re-encoded on the server. Viewers can watch the trailers and press
**Notify Me**: the title goes into the Auto Download queue and is downloaded
on release day.

## How titles are picked (server)

- Source: TMDB, refreshed every 12 hours (and from Settings → Auto Download →
  Check Now).
- **Movies:** upcoming US productions (Hollywood) in English, in theaters or
  digital between tomorrow and Dec 31 next year. They need an official
  YouTube trailer, artwork and a well-known cast. Documentaries are excluded.
- **Series:** brand-new US/UK series, plus new seasons of popular shows (when
  the next episode is a season premiere). Talk, news, reality, soap and kids
  shows are excluded.
- **Ranking:** popularity combined with "star power" (how popular the
  top-billed cast is). Titles releasing far in the future count slightly
  less. Obscure titles are filtered out with minimum thresholds.
- **Never already out:** a movie that has opened in theaters anywhere
  (limited or wide), or whose release date has passed, is left out. So is
  anything already in the library: the movie, a new series, or that new
  season. This is checked when the lineup is built and again every time it
  is served, so a title imported between refreshes disappears immediately.
- **No duplicates:** one entry per title and per trailer.
- **Rotation:** new titles are queued for download. Titles that are released
  or drop out of the top 10 are removed with their video. When a better
  trailer appears (a trailer replacing a teaser), the video is replaced.

## Trailer files

- The best trailer up to 1080p is downloaded with **HomeFlix's own yt-dlp**.
  The official standalone build is fetched from GitHub into
  `data/comingsoon/bin`, verified against the release's SHA-256 checksums
  and updated weekly; nothing has to be installed by hand. Node (already on
  the server) is used as yt-dlp's JavaScript runtime. The trailer is then
  re-encoded for direct playback everywhere:
  **H.264 High@4.1, ≤1920×1080, AAC stereo 128 kb/s, MP4 with faststart**.
- Space: 1 GB for all 20 trailers by default (configurable). Each trailer is
  encoded to its share, about 50 MB, which is roughly 2.5 Mb/s of 1080p
  video for a 2.5-minute trailer.
- If the budget is ever exceeded, the lowest-ranked trailers are dropped
  first.
- If the downloader isn't ready, or before a download finishes, a title
  still appears; use its `youtube_id` instead.

## API (for the TV app)

All paths are relative to the HomeFlix server (`http://<server>:8252`).

### `GET /api/comingsoon`

Optional `?type=movie` or `?type=tv`.

```json
{
  "movies": [
    {
      "tmdb_id": 1234,
      "media_type": "movie",
      "title": "…",
      "overview": "…",
      "tagline": "…",
      "release_date": "2026-12-18",
      "release_label": "",              // tv: "New Series" or "Season 3"
      "season": 0,                      // tv: the season that premieres
      "days_until": 45,
      "poster_url": "https://image.tmdb.org/t/p/w500/….jpg",
      "backdrop_url": "https://image.tmdb.org/t/p/w1280/….jpg",
      "genres": ["Action", "Drama"],
      "cast": ["…", "…", "…"],          // top-billed, up to 4
      "studio": "…",                    // tv: the network
      "rank": 1,
      "trailer": {
        "state": "ready",               // ready | pending | downloading | encoding | failed | no_downloader | over_budget
        "video_url": "/api/comingsoon/video/movie-1234.mp4",   // only when ready
        "youtube_id": "abcDEF12345",    // always set: fallback
        "width": 1920, "height": 1080, "duration": 152.3, "bytes": 49810000
      },
      "notify": { "on": false, "status": "" }   // status: Auto Download state when on
    }
  ],
  "series": [ … same shape, media_type "tv" … ],
  "refreshed": "2026-11-03T12:00:00Z"
}
```

Both lists are sorted by `rank`. Fetch again whenever the screen opens; it's
small and cheap.

### `GET /api/comingsoon/title/:type/:id`

One title, in the same shape as a list entry. Returns 404 when the title
isn't coming soon (not in the lineup, released, or already in the library).
Title pages use it to show the Coming Soon panel.

### `GET /api/comingsoon/video/:file`

The MP4. Supports HTTP range requests, so ExoPlayer can seek. It is cached
for a day (`Cache-Control: public, max-age=86400`).

```kotlin
val item = MediaItem.fromUri(server + trailer.video_url)   // progressive MP4
player.setMediaItem(item); player.prepare(); player.play()
```

If `video_url` is missing, play `youtube_id` the way Live TV's YouTube
channels do: an embedded WebView, or hand off to the YouTube app.

### `POST /api/comingsoon/notify`

```json
{ "media_type": "movie", "tmdb_id": 1234 }
```

This adds the title to Auto Download, held until the release date. For a
series it adds that season and follows the show for later seasons. The
response is:

```json
{ "on": true, "status": "queued", "message": "HomeFlix will download … when it's released" }
```

The title is downloaded on release day with the quality profile from
Settings → Auto Download. The usual notifications follow ("Downloading …",
"… is ready to watch").

### `DELETE /api/comingsoon/notify/:type/:id`

Turns Notify Me off. It removes the queued Auto Download entry, unless the
download has already started, and unfollows a show.

## TV app: suggested experience

- **Home row "Coming Soon":** backdrop cards with title and date ("In 12 days"
  under 45 days, otherwise "Dec 18"), and a small bell when Notify Me is on.
  Use movies and series as two rows, or one row with a Movies/Series toggle.
- **Focus a card:** after about 700 ms, play its trailer muted in the
  background of the row header (one player, reused).
- **Open a title:** full-screen trailer with sound. Over the lower third show
  title, release label and date, studio · genres, "Starring …", and a short
  overview.
- **Buttons:** **Notify Me** (bell; becomes "We'll Notify You" ✓), Play
  Trailer, Details.
- **When a trailer ends:** go to the next title (like a channel).
- **D-pad:** ◀ ▶ previous/next title, OK = Notify Me toggle, Back = close.
- **Status:** show `notify.status` (`scheduled`, `queued`, `downloading`,
  `completed`). Once completed, the title is in the library and "Play" can
  open it.
