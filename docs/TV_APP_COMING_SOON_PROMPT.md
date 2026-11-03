# Prompt: Coming Soon in the HomeFlix TV app

Paste the text below into the TV app developer's session (repository
`azad25/homeflix-tv-app`).

---

You're working on the HomeFlix Android TV app (Kotlin, `azad25/homeflix-tv-app`).
Add a **Coming Soon** experience: the most anticipated upcoming movies and
series with their trailers, and a **Notify Me** button that has the server
download the title on release day.

The server side is done and lives in `azad25/homeflix-wifi` on branch
`release/v5.5`. Read `docs/COMING_SOON.md` there first. It is the API
contract and describes how titles are picked. `docs/LIVE_TV.md` shows how
the app already plays HLS and YouTube for Live TV; reuse those patterns. All
endpoints are relative to the configured HomeFlix server
(`http://<server>:8252`), the same base the app already uses.

## Server API you'll use

- `GET /api/comingsoon` (optional `?type=movie|tv`) returns
  `{ movies: [...], series: [...], refreshed }`, each list ranked (`rank` 1
  first, up to 10 each). Each item has:
  - `tmdb_id`, `media_type` (`movie` | `tv`)
  - `title`, `overview`, `tagline`
  - `release_date` (YYYY-MM-DD), `days_until`
  - `release_label` (tv: "New Series" or "Season 3"), `season`
  - `poster_url`, `backdrop_url` (full TMDB URLs)
  - `genres`, `cast` (top-billed), `studio` (tv: the network)
  - `trailer { state, video_url?, youtube_id, width, height, duration }`
  - `notify { on, status }`
- `video_url` (when `trailer.state == "ready"`) is a server-relative MP4:
  H.264 High@4.1, up to 1080p, AAC stereo, faststart. It supports range
  requests. Play it with ExoPlayer as a progressive MP4 (no HLS), e.g.
  `MediaItem.fromUri(server + video_url)`.
- When `video_url` is missing (download still pending, or it failed), fall
  back to `youtube_id`. Use the same approach as Live TV's YouTube channels:
  an embedded `youtube-nocookie.com/embed/<id>` WebView with the D-pad still
  handled by the app, or an `ACTION_VIEW` hand-off to the YouTube app.
- `POST /api/comingsoon/notify` with body
  `{"media_type": "...", "tmdb_id": 123}` turns Notify Me on. The server
  queues the title in Auto Download, held until release day (series: that
  season, plus later seasons). The response is
  `{ on: true, status, message }`.
- `DELETE /api/comingsoon/notify/{media_type}/{tmdb_id}` turns it off.
- `GET /api/comingsoon/title/{media_type}/{tmdb_id}` returns one title, or
  404 if it isn't coming soon. Use it on any detail screen to decide
  whether to show the Coming Soon panel.
- The server already guarantees no duplicates, no titles already out (in
  theaters or aired), and nothing already in the library. Don't filter
  again. Fetch fresh each time the screen opens; responses are small.

## What to build

1. **Home row "Coming Soon".**
   - Wide backdrop cards in rank order: movies first, then series, or two
     rows ("Coming Soon: Movies", "Coming Soon: Series"), whichever fits the
     existing home layout.
   - Each card shows the title, a date line ("In 12 days" when
     `days_until` ≤ 45, otherwise "Dec 18" / "Feb 2027"), a "Season 3" or
     "New Series" chip for tv, and a small bell badge when `notify.on`.
   - Focus behaviour: when a card has been focused for about 700 ms, play
     its trailer muted in the row's header area, the same way the app
     previews other rows. Reuse one player instance; stop it when focus
     leaves the row.

2. **Coming Soon screen** (open a card or a menu entry).
   - Full-screen trailer, sound on, starting with the selected title. When a
     trailer ends, move to the next title, like changing channel.
   - Info overlay in the lower third, fading out after ~4 s of no input and
     back on any key:
     - title, `release_label` and full date ("Friday, February 12, 2027"),
       and a countdown ("In 101 days");
     - studio · genres, "Starring A, B, C", and a 2-line overview.
   - Buttons:
     - **Notify Me** (bell). When on it reads "We'll Notify You" with a
       check, and shows `notify.status` small ("scheduled", "queued",
       "downloading").
     - **Details** opens the app's existing TMDB detail screen for
       `tmdb_id` / `media_type`.
   - Remote:
     - ◀ ▶: previous / next title.
     - OK: toggle Notify Me (or press the focused button).
     - ▲ ▼: move between the overlay buttons and a strip of upcoming
       titles along the bottom.
     - Back: close the overlay, then leave the screen.
     - Play/Pause: pause the trailer.
   - Keep the player alive while switching titles; call `setMediaItem` and
     `prepare` instead of recreating it, and show the backdrop until the
     first frame renders.

3. **Detail screens.** For any title, call
   `GET /api/comingsoon/title/{type}/{id}`. On 200, show a Coming Soon
   panel: date and countdown, a "Play Trailer" button (local MP4, else
   YouTube) and Notify Me. On 404, show nothing new.

4. **Notify Me everywhere is the same call.**
   - Update the UI optimistically and roll back if the request fails.
   - After toggling, refresh that title (`/api/comingsoon/title/...`) so
     `notify.status` is current.
   - When the title later downloads, the server sends its usual
     notifications ("Downloading …", "… is ready to watch"); nothing extra is
     needed in the app.

## Quality bar

- **Speed:** trailers must start within about a second on a typical TV box.
  The files are local and faststart, so buffer small: use the app's
  existing `DefaultLoadControl` settings for VOD.
- **Layout:** follow the app's existing Apple TV-like look. Respect the
  48 px TV-safe margins. Focus must always be visible and never get lost
  when the list refreshes.
- **Empty or partial data:** if both lists are empty or the request fails,
  hide the row and the menu entry rather than showing an error. Items with
  `trailer.state` other than "ready" still show; they play the YouTube
  fallback.
- **No server changes.** If the API is missing something you need, list it
  in your summary instead of working around it.
- **Testing:** test with a real server on the LAN, or with a recorded JSON
  response and any 1080p H.264 MP4 served locally.
- **Docs:** when you're done, update `docs/LIVE_TV.md`'s "TV app status"
  style table in your summary: what's done and what isn't, and the app
  version.
