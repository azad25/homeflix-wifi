# Live TV

HomeFlix builds a Live TV lineup from public, free-to-air stream listings
(the community-maintained [iptv-org](https://github.com/iptv-org/iptv) index),
checks which streams actually work **from your server**, and relays them to
the web app and the TV app through its own signed HLS proxy.

- Countries, excluded categories and your own M3U playlists are set in
  **Settings > Live TV**. Adult channels are always excluded.
- The list is refreshed daily; every stream is health-checked every 6 hours
  (playlist -> variant -> first video segment, so geo-blocked streams are
  caught). Data lives in `backend/data/livetv/` (`HOMEFLIX_LIVETV_DIR`).
- Players never talk to broadcasters directly. That avoids CORS/referrer
  problems in browsers, lets several TVs on the same channel share one
  upstream fetch (short shared segment cache), and keeps working when a
  stream needs a special User-Agent or Referer.
- The proxy only serves URLs it signed itself (HMAC), and streams from the
  public listings can never reach addresses on your local network. Streams
  from your own playlists may (e.g. a tuner on the LAN).

## API (for the HomeFlix TV app)

All paths are relative to the HomeFlix server (`http://<server>:8252`).

### `GET /api/livetv/channels`

Optional query: `country=BD`, `category=news`, `q=somoy`.

```json
{
  "enabled": true,
  "channels": [
    {
      "id": "SomoyTV.bd",
      "name": "Somoy TV",
      "country": "BD",
      "categories": ["news"],
      "logo": "https://…/somoy.png",
      "status": "online",          // online | offline | unknown
      "quality": "720p",
      "number": 12,                // stable channel number for the remote
      "favorite": true             // only present on favourites
    }
  ],
  "favorites": ["SomoyTV.bd"],
  "countries":  [{ "code": "US", "count": 812 }],
  "categories": [{ "code": "news", "count": 230 }],
  "updated_at": "2026-11-02T20:26:30Z",
  "syncing": false
}
```

`number` is the position in the full lineup (not the filtered list), so
"channel 12" is the same channel whatever filter is active. **Favourites come
first** (in channel-number order), then the rest, sorted by country, then name.
Add `order=number` for plain channel-number order. If `enabled` is false, hide
Live TV.

### Favourites

Favourites are stored on the server and shared by every device (the web Live TV
page's star sets them).

- `GET /api/livetv/favorites` → `{ "favorites": ["id", …] }`
- `PUT /api/livetv/favorites/:id` adds one (404 if the channel is unknown).
- `DELETE /api/livetv/favorites/:id` removes one.
- `POST /api/livetv/favorites` with `{ "ids": [...] }` adds several.

### `GET /api/livetv/channels/:id/play`

```json
{
  "channel": { …same fields as above… },
  "urls": [
    "/api/livetv/p/<sig>/<token>/index.m3u8",
    "/api/livetv/p/<sig>/<token>/index.m3u8"
  ]
}
```

Some channels are broadcasters' official **YouTube live streams** (or have
one as a backup source). Then the response also has
`"youtube_id": "<11-char video id>"` (it may come with an empty `urls`). Play
the HLS `urls` first; if there are none or all fail, play `youtube_id`:
on the TV app either embed `https://www.youtube-nocookie.com/embed/<id>?autoplay=1&controls=0`
in a WebView (keep D-pad handling in the app: channel up/down still zaps),
or hand off to the YouTube app with an `ACTION_VIEW` intent for
`https://www.youtube.com/watch?v=<id>`. Such channels report `quality: "YouTube"`.

`urls` are HLS playlists, best first (working, smooth 1080p/720p before
4K, fastest). Prefix them with the server URL and play the first; on a
fatal player error move to the next one; when all fail show "not available
right now". Ask for `/play` again on every tune: URLs are cheap and the
order follows the latest health check.

### Playing (ExoPlayer / Media3)

```kotlin
val item = MediaItem.Builder()
    .setUri(server + urls[i])
    .setMimeType(MimeTypes.APPLICATION_M3U8)
    .setLiveConfiguration(
        MediaItem.LiveConfiguration.Builder().setTargetOffsetMs(12_000).build()
    )
    .build()
player.setMediaItem(item); player.prepare(); player.play()
```

- Use `HlsMediaSource`; no extra headers are needed (the proxy adds them).
- `onPlayerError` -> try the next URL. A `BehindLiveWindowException` means
  "seek to the live edge and prepare again", not "channel broken".

## TV app: live TV experience (spec)

The goal is to feel like a cable box, not a video app: channels start in
about a second, the remote changes channel at any time, and the screen
always tells you where you are.

### Entry points

- **Home row "Live TV"**: favorites first, then the last 10 watched; each
  tile shows the logo on a dark card, the number and a red LIVE dot.
- **Live TV tab** opens straight into full-screen playback of the last
  channel (or channel 1). Optional setting: "Start HomeFlix on Live TV".

### Full-screen player (default state)

- Video only. Nothing else on screen while watching.
- **Info banner** (bottom, ~3 s after every channel change or on INFO):
  big channel number, logo on a white rounded tile, channel name,
  `● LIVE`, category · quality · country, clock on the right. Black
  gradient from the bottom, 48 px side margins (TV safe area).
- **Tuning screen** while a channel loads: black, centred logo + small
  spinner. Never show the previous channel's last frame for the new name.
- **No signal** (all URLs failed or 10 s without video): "<Name> isn't
  available right now" + "Press ▲ ▼ for another channel"; do NOT leave the
  channel automatically.
- **Number entry**: digits appear top-right (`1 2 _`), tune ~1.2 s after
  the last digit, or immediately on OK.
- **Volume HUD** (if the app controls volume): small pill at the top.

### Remote mapping

| Key | Action |
| --- | --- |
| D-pad ▲ / CH+ | previous channel in the current list |
| D-pad ▼ / CH- | next channel |
| OK / Enter | mini guide (overlay list, see below) |
| D-pad ◀ | full guide |
| D-pad ▶ | channel info / favorites toggle |
| 0-9 | number entry |
| Back | close overlay; otherwise return to the **last channel**; press Back twice quickly to leave Live TV |
| INFO / Menu | info banner / options (favorite, audio track, subtitles if any) |

### Mini guide (OK)

- Left panel ~35 % width over the playing video, translucent black with
  blur. Rows: number, logo, name, category. The highlighted row is white
  with black text; the playing channel has `● NOW`.
- Opens on the current channel, ▲▼ move, OK tunes and closes, Back
  closes, wraps at both ends. Video keeps playing behind it.

### Full guide (◀)

- Full screen, two columns: left = groups (Favorites, All, each country
  with flag + count, each category), right = channel list for the group.
- Focused channel shows a live preview in a small window top-right
  (start it after ~600 ms of focus, mute it, reuse one player).
- `GET /api/livetv/channels` gives countries/categories with counts; use
  `number` for display and number entry.

### Zapping fast

- Keep **one** ExoPlayer instance for the session; on zap call
  `setMediaItem(...)` + `prepare()` instead of releasing/recreating.
- Use `DefaultLoadControl` with a small start buffer for live
  (e.g. `bufferForPlaybackMs = 1500`, `bufferForPlaybackAfterRebufferMs = 3000`).
- Debounce: if ▲▼ is pressed repeatedly, only tune after 400 ms of no key
  presses, but update the banner (number/name/logo) immediately on every
  press so it feels instant.
- Fetch `/api/livetv/channels/:id/play` for the next and previous channel
  in the background after a tune (they're tiny), so the next zap skips a
  round trip.
- On a fatal error try the next URL from `/play`; after the last one show
  No signal.

### Favorites and memory

- Favorites live on the TV (DataStore), keyed by channel `id`.
- Remember the last channel and the previous one (for Back).
- Hide the adult category entirely (the server already excludes it).

## TV app status (HomeFlix TV 5.13.2)

Implemented in `azad25/homeflix-tv-app` (`app/src/main/java/com/homeflix/tv/livetv/`):

| Spec item | Status |
| --- | --- |
| Home row "Live TV": entry tile (last channel), favorites, then recently watched; logo card, number, LIVE dot | done |
| "Live TV" on the top menu → full screen on the last channel (or channel 1); hidden when `enabled` is false | done |
| Video-only default; info banner ~3 s (number, logo tile, name, ● LIVE, category · quality · country, clock) | done |
| Tuning screen (black, logo, spinner; never the old picture under the new name) | done |
| No signal after all URLs fail or 10 s without video; no auto-skip | done |
| Number entry `1 2 _`, tunes 1.2 s after the last digit or on OK | done |
| Remote: ▲/CH+ previous, ▼/CH- next, OK mini guide, ◀ full guide (also GUIDE), ▶ / INFO / MENU info + favorite, 0-9, Back = last channel, Back twice = leave | done |
| Mini guide: left 35 %, ● NOW, opens on the current channel, wraps, OK tunes, Back closes | done |
| Full guide: groups (Favorites, All, countries with flags + counts, categories); muted preview after 600 ms in a window, using the same player | done |
| One ExoPlayer per session; buffer 1.5 s / 3 s; live offset 12 s; 400 ms zap debounce; prefetch `/play` for neighbours; BehindLiveWindow → live edge | done |
| HLS → next URL → "not available" | done |
| YouTube channels | **not used on the TV** (they didn't play reliably): the TV hides `quality: "YouTube"` channels and ignores `youtube_id`; offline channels are hidden too. Turn off "Official YouTube" in Settings → Live TV to drop them everywhere. |
| Light on 2 GB TVs: 6–15 s / 12 MB buffers, 1080p cap, SurfaceView, lineup cached 10 min | done |
| Favorites, last and previous channel, recents in DataStore | done |
| Volume HUD, "Start HomeFlix on Live TV" setting, audio/subtitle options | not yet |

`/play` now reports the same channel `number` as `/channels`.
