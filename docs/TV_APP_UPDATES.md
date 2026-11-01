# HomeFlix TV app updates (no Play Store)

The HomeFlix server publishes new builds of the Android TV app, and the TVs
update themselves: they download the build in the background, verify it, and
ask for **one OK press** ("Update now"). Settings and watch progress are kept.

```
you ──APK──▶ backend/app-updates/tv/  ──▶  GET /api/app/tv/latest  ◀── TV app (launch, every 6 h, on resume)
                    │                                                  ▲
                    └── new version ──▶ cast socket {"type":"update_available"} ──┘ (instant)
```

## Publishing a new build

Pick one of these:

- **Drop the file in:** copy the APK into `backend/app-updates/tv/`. The file name doesn't matter, because the version is read from the APK itself. The folder is rescanned every minute. Optionally, add release notes in a text file with the same name: `homeflix-tv-8.apk` → `homeflix-tv-8.txt`.
- **Upload it:**
  ```bash
  curl -F apk=@homeflix-tv-v5.apk -F notes="Faster trailers, cast fixes" \
       http://<server>:8252/api/admin/app/tv/upload
  ```
- **Rescan now** instead of waiting for the next minute:
  ```bash
  curl -X POST http://<server>:8252/api/admin/app/tv/rescan
  ```

The highest `versionCode` wins. Older files can stay in the folder. Connected TVs
are told about a new version immediately; the rest find it on their next check.

> Bump `versionCode` in the TV app's `app/build.gradle.kts` for every release.
> TVs only update to a **higher** version.

Override the folder with `HOMEFLIX_TV_UPDATES_DIR=/path/to/dir`.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/api/app/tv/latest` | `200` with `{version_code, version_name, url, sha256, size, notes, released_at, package}`; `404` when nothing is published. |
| GET/HEAD | `/api/app/tv/download/{version_code}` | The APK. Supports Range and caching, and sends an `X-Content-SHA256` header. |
| POST | `/api/admin/app/tv/upload` | Multipart: `apk` (file) and `notes` (optional). Returns `422` if the file isn't a `com.homeflix.tv` APK. |
| POST | `/api/admin/app/tv/rescan` | Re-read the folder now. |

Push to TVs (over the cast WebSocket, see `TV_CAST_PROTOCOL.md`):
`{"type":"update_available","version_code":8,"version_name":"5.3"}`.

## Safety

- **Server:** only APKs with package `com.homeflix.tv` are published.
- **TV checks before installing:**
  - size and SHA-256 match `/latest`;
  - the package name matches;
  - `versionCode` matches;
  - the APK is signed with the **same key** as the installed app.
- **Android:** refuses an update signed with a different key anyway. So a stray or
  malicious upload can't replace the app, even though the admin endpoints have no
  authentication (same LAN trust model as the rest of the server).

## On the TV

- **One-time setup:** Settings → *App updates* → **Allow HomeFlix to install updates**
  (Android's "Install unknown apps" switch). The first update prompt also takes you there.
- **When an update is ready,** an "Update available" dialog appears on the browse
  screens (never during playback). "Later" hides it until the next app launch.
  Settings → *App updates* also has **Check for updates** and **Install update**.
- **Android 12 and newer:** once HomeFlix has installed one update itself, later
  updates skip the extra system confirmation screen.
