# HomeFlix Cast — TV app integration spec

How the **HomeFlix TV app** (Android TV, `homeflix-tv-app`) receives "cast"
requests from the HomeFlix web app or a phone browser, similar to YouTube's
cast button: the user taps **Cast → Living Room TV** while watching in the
browser, the TV app opens (or comes to the front) and starts playing the same
title at the same position. The browser then becomes a remote.

The HomeFlix **server relays everything**. The TV app keeps a WebSocket open to
the server; the browser talks to the server over HTTP. No Google Cast
registration, no HTTPS, and no UDP discovery are needed. It works on any LAN where
the TV app can already reach the HomeFlix server.

```
Browser ──HTTP POST /api/cast/devices/:id/command──▶ HomeFlix server ──WebSocket──▶ TV app
Browser ◀──SSE /api/cast/devices/:id/events───────── HomeFlix server ◀──WebSocket── TV app (status)
```

The server side is implemented in `backend/internal/services/cast_hub.go` and
`backend/internal/api/handlers/cast_handlers.go`, with tests in
`cast_handlers_test.go`. The web side is in
`frontend/src/hooks/useHomeflixCast.ts` and
`frontend/src/components/cast/HomeflixCastControl.tsx`.

---

## 1. Connect

```
GET ws://<server>:8252/api/cast/tv/ws
      ?device_id=<stable id>
      &name=<display name>
      &platform=androidtv
      &app_version=<versionName>
```

| Param | Required | Notes |
|---|---|---|
| `device_id` | yes | Stable per install. Generate a UUID once, store it in SharedPreferences. ≤128 chars. Reconnecting with the same id replaces the previous connection. |
| `name` | no | Shown in the browser's cast menu, e.g. `Living Room TV`. Default: `Settings.Global.DEVICE_NAME`, falling back to `Build.MODEL`. Let the user rename it in settings. ≤80 chars. |
| `platform` | no | `androidtv`, `firetv`, `googletv`… |
| `app_version` | no | `BuildConfig.VERSION_NAME` |

Use the **same server base URL** the app already uses for `/api/...` calls
(`http://` → `ws://`, `https://` → `wss://`). Send the usual
`User-Agent: homeflix-tv/<version>` header.

On connect the server sends:

```json
{ "type": "hello", "device_id": "…", "server_time": "2026-11-01T18:58:39Z" }
```

### Keep-alive & reconnect (important)
- The server sends a WebSocket **ping frame** and a `{"type":"ping"}` text message every **25s**.
  Reply to the text ping with `{"type":"pong"}`. OkHttp answers ping frames automatically.
- The server drops connections silent for **70s**. Also set `OkHttpClient.pingInterval(20, SECONDS)`.
- **Reconnect forever** with backoff: 1s, 2s, 4s… capped at 30s, with jitter. Reset after a successful `hello`.
  Reconnect immediately when the network comes back (`ConnectivityManager.NetworkCallback`).
- If the server URL changes in settings, close and reconnect.

---

## 2. Commands (server → TV)

Every command looks like:

```json
{
  "type": "command",
  "command_id": "c1730487519194-7",
  "action": "play",
  "media": { "id": 42, "type": "movie", "title": "Inception",
             "series_id": null, "season": null, "episode": null,
             "poster": "http://…/api/posters/42" },
  "position": 2230,
  "from": "Chrome on Mac",
  "sent_at": "2026-11-01T18:58:42Z"
}
```

| `action` | Fields | What the TV does |
|---|---|---|
| `play` | `media` (required), `position` (seconds, optional) | Bring the app to the foreground, open the player for `media.id`, seek to `position`, start playing. If something else is playing, replace it. |
| `pause` | — | Pause. |
| `resume` | — | Resume. |
| `seek` | `position` (seconds) | Seek. |
| `stop` | — | Stop playback and close the player (return to the previous screen). |
| `volume` | `volume` (0..1), `muted` (bool), both optional | Set app or player volume. Optional to support. |
| `subtitle` | `subtitle` (track id string, `""` = off) | Optional to support. |

Ignore unknown fields. For an unknown action, send `ok:false` with
`"error":"unsupported action"`.

### Other server → TV messages
- `{"type":"update_available","version_code":8,"version_name":"5.3"}`: a new TV app
  build was published. Check `/api/app/tv/latest` now. No ack is needed. See `TV_APP_UPDATES.md`.

### Acknowledge every command within 8 seconds

```json
{ "type": "ack", "command_id": "c1730487519194-7", "ok": true }
{ "type": "ack", "command_id": "c1730487519194-7", "ok": false, "error": "Media not found" }
```

The browser waits for this:
- `ok:true` → the browser shows "Playing on Living Room TV".
- `ok:false` → the browser shows your `error` text.
- No ack within 8s → the browser shows "The TV didn't respond".

For `play`, ack **once you have accepted the command and started opening the
player**. Don't wait for the first frame. Report loading/playing progress
through `status` messages.

### Resolving `media`
- **Movie** (`type: "movie"`): `GET /api/media/{id}` gives the media record. Play it
  exactly as the app does today: `GET /api/stream/{id}/info?client=tv` to choose
  between direct play and HLS, then `/api/stream/{id}` or
  `/api/stream/{id}/hls/index.m3u8`.
- **Episode** (`type: "episode"`): the `id` is the episode's media id, so play it the same way.
  `series_id`, `season` and `episode` are provided so you can show
  "S1:E3" and wire up "next episode" like the normal player does.
- Keep saving progress through the usual `POST /api/playback/progress`. Casting
  should feel identical to pressing Play on the TV.

---

## 3. Status (TV → server)

Send a status message:
- whenever the player state changes (loading, playing, paused, buffering, ended, error);
- every **1–2 seconds while playing** (position updates);
- right after a (re)connect, so a browser that's watching gets the current state.

```json
{
  "type": "status",
  "state": "playing",
  "media_id": 42,
  "media_type": "movie",
  "title": "Inception",
  "position": 2231.4,
  "duration": 8880,
  "volume": 1.0,
  "muted": false,
  "error": ""
}
```

`state` is one of `idle`, `loading`, `playing`, `paused`, `buffering`, `ended`, `error`.
- `ended` → the browser ends the cast session and keeps its own player paused.
- `error` → put a readable message in `error`; the browser shows it.
- `idle` → nothing playing (after `stop`, or when the user leaves the player).

Optional: `{"type":"rename","name":"Bedroom TV"}` updates the display name without
reconnecting.

---

## 4. Android implementation guide (for the TV app)

### 4.1 Where the connection lives
Run the WebSocket in a small **`CastReceiverService`**, a foreground service
with a low-priority ongoing notification ("HomeFlix is ready to cast"). That way
the TV stays castable while another app is open:

- Start it from `Application.onCreate()` and from a `BOOT_COMPLETED` receiver,
  so it's ready after the TV powers on.
- Manifest:
  ```xml
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC"/> <!-- API 34+ -->
  <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
  <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/> <!-- see 4.3 -->
  <service android:name=".cast.CastReceiverService"
           android:foregroundServiceType="dataSync" android:exported="false"/>
  <receiver android:name=".cast.BootReceiver" android:exported="true">
      <intent-filter><action android:name="android.intent.action.BOOT_COMPLETED"/></intent-filter>
  </receiver>
  ```
- Use one shared `OkHttpClient` (`pingInterval(20, SECONDS)`, `readTimeout(0)`)
  and `client.newWebSocket(request, listener)`.
- Parse messages with the JSON library the app already uses (Moshi, Gson or
  kotlinx.serialization). Use one data class per message type.

### 4.2 Handling `play`
1. Ack immediately (`ok:true`), unless the media id is invalid. Then fetch
   `/api/media/{id}` first and ack `ok:false` if it returns 404.
2. Launch the player activity:
   ```kotlin
   val i = Intent(ctx, PlayerActivity::class.java).apply {
       addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
       putExtra("media_id", cmd.media.id)
       putExtra("media_type", cmd.media.type)
       putExtra("start_position_ms", ((cmd.position ?: 0.0) * 1000).toLong())
       putExtra("cast_command_id", cmd.commandId)
       putExtra("cast_from", cmd.from)
   }
   ctx.startActivity(i)
   ```
   If `PlayerActivity` is already on top, handle the new media in `onNewIntent()`.
3. Show a brief toast or overlay: **"Casting from Chrome on Mac"** (`from`).
4. Route `pause`/`resume`/`seek`/`stop`/`volume` to the current player. A simple
   way is a process-wide `CastController` singleton that `PlayerActivity`
   registers its `ExoPlayer` with in `onStart` and unregisters from in `onStop`.
   If no player is registered, ack `ok:false` with `"error":"Nothing is playing"`.
5. Status: attach a `Player.Listener` to ExoPlayer/Media3.
   - Map `onIsPlayingChanged` and `onPlaybackStateChanged` to `state`:
     `STATE_BUFFERING`→`buffering`, `STATE_ENDED`→`ended`, `isPlaying`→`playing`, otherwise `paused`.
   - Map `onPlayerError` → `error`.
   - Post `position`/`duration` (in seconds) every 1s from a `Handler` while playing.
   - When the activity finishes, send `idle`.

### 4.3 Opening the app from the background (Android 10+)
Android 10+ blocks activity starts from the background. Options, in order of preference:

1. **"Display over other apps" (`SYSTEM_ALERT_WINDOW`).** Apps holding it may start activities
   from the background. Ask once from the TV app's settings screen
   (`Settings.ACTION_MANAGE_OVERLAY_PERMISSION`). Some Android TV builds hide that
   screen; then it can be granted with
   `adb shell appops set <package> SYSTEM_ALERT_WINDOW allow`.
   Check with `Settings.canDrawOverlays(ctx)`.
2. **Fallback when not granted:** post a high-priority notification with a full-screen
   intent ("Inception: tap to play"), and still ack `ok:true`.
   Also send a status update with `state:"loading"`, then
   `{"state":"error","error":"Open HomeFlix on the TV to start playback"}` if the
   activity doesn't start within ~10s. The browser shows this to the user.
3. If the app is already in the foreground, none of this applies: it just works.

Android 9 and older TV boxes have no restriction.

The TV must be **on**. Waking a TV from standby needs HDMI-CEC and is out of scope.

### 4.4 Settings screen additions
- **Cast name** (editable; send `rename` when it changes).
- **"Allow casting to this TV"** toggle. When off, stop the service and close the socket.
- Status line: "Ready to cast" or "Not connected to the server".
- Button: "Allow HomeFlix to open from casting", which opens the overlay-permission screen (4.3).

### 4.5 Edge cases to handle
- A new `play` while something else is playing: replace it (don't stack activities).
- A new `play` for the *same* media: just seek to `position` and play.
- The TV user presses Back during a cast: stop playback, send `idle`.
- Network loss mid-play: keep playing locally, reconnect in the background, and send a
  fresh `status` after `hello`.
- Several browsers controlling one TV is fine: last command wins.
- Several TVs: each has its own `device_id`. Nothing extra is needed.

---

## 5. Test without the web UI

```bash
# list TVs (should show yours as online)
curl http://<server>:8252/api/cast/devices

# play media 42 from 10 minutes in
curl -X POST http://<server>:8252/api/cast/devices/<device_id>/command \
     -H 'Content-Type: application/json' \
     -d '{"action":"play","media":{"id":42,"type":"movie","title":"Test"},"position":600}'

curl -X POST …/command -d '{"action":"pause"}'
curl -X POST …/command -d '{"action":"seek","position":1200}'
curl -X POST …/command -d '{"action":"stop"}'

# watch status updates
curl -N http://<server>:8252/api/cast/devices/<device_id>/events
```

HTTP responses from `/command`:
- `200 {"ok":true}`: the TV accepted the command.
- `422 {"ok":false,"error":…}`: the TV refused it; `error` is your message.
- `404`: the TV is offline.
- `504`: no ack within 8s.
- `400`: the request was invalid.

## 6. Acceptance checklist
- [ ] The TV appears in the browser's cast menu within ~2s of the app starting, and after a TV reboot.
- [ ] Cast from the web player: the TV opens the player and starts at the same position within ~3s.
- [ ] Pause, resume, seek and stop from the browser remote work, and the browser's seek bar follows the TV.
- [ ] Back on the TV ends the browser's remote session (the TV sends `idle` or `ended`).
- [ ] Casting while the TV is on another app works when the overlay permission is granted,
      and shows the notification fallback otherwise.
- [ ] Wi-Fi drop/restore: the TV reconnects within ~30s without restarting the app.
- [ ] Watch progress from a cast session shows up in Continue Watching.
