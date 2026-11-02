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
      "number": 12                 // stable channel number for the remote
    }
  ],
  "countries":  [{ "code": "US", "count": 812 }],
  "categories": [{ "code": "news", "count": 230 }],
  "updated_at": "2026-11-02T20:26:30Z",
  "syncing": false
}
```

`number` is the position in the full lineup (not the filtered list), so
"channel 12" is the same channel whatever filter is active. Sort is by
country, then name. If `enabled` is false, hide Live TV.

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

## Suggested TV experience

- A **Live TV** row on the home screen and a full-screen guide: channel
  list on the left (number, logo, name), preview on the right.
- D-pad up/down or **CH+/CH-** zap through the current list; digits type a
  channel number (switch after ~1.2 s); **Back** shows the guide.
- Show an OSD banner for ~3 s after each switch: number, logo, name, LIVE.
- Remember the last channel and start there; keep favorites on the TV.
- Prefer `/play` URLs over caching them: the server re-checks streams.
