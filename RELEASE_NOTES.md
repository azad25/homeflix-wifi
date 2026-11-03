# HomeFlix 5.5.1

Coming Soon trailers, a live Scanner page, TMDB rows with hover trailers,
Letterboxd and more news sources, and a black & white look.

## New

- **Coming Soon**: the 10 most anticipated upcoming movies and 10 series
  (this year and next), picked from TMDB by popularity and cast.
  - Trailers are kept on the server in 1080p, within 1 GB for all 20.
  - **Notify Me** downloads the title on release day.
  - It's never something already out in theaters or already in your library.
  - Shown on Home, Movies, TV Shows and each title's page.
  - HomeFlix installs and updates its own yt-dlp.
- **Settings → Scanner**: watch scans live.
  - Progress, speed and time left.
  - The scanner's lines as the server terminal shows them.
  - Scan history and a library analysis.
  - Health checks with one-click fixes: missing files, unmatched titles,
    files not yet analysed, duplicates.
- **TMDB rows on Home, Movies and TV Shows** (Trending, In Theaters, Top Rated,
  New Episodes…). Hover a card to play its trailer.
- **What's New**:
  - Letterboxd: follow members' diaries and reviews; the Letterboxd Journal
    is a news source.
  - More news sources: IMDb News, Rotten Tomatoes, MovieWeb, CBR, Den of Geek,
    JoBlo, ComingSoon.net.
  - A refreshed page and an Apple TV-style mosaic.
- **New black & white logo and icons**, and one consistent Settings theme:
  green, blue and red only for states.
- **Downloads use every available drive**, including external ones; Auto
  Download picks a release that fits instead of waiting on one full drive.

## Fixed

- A show's episode list could include another show's episode.
- Unplugged drives could make downloads land on the system disk.
- Scan status could hang while a scan was running.

## Upgrading

Go to **Settings → Software Update → Update**. Coming Soon fills itself within
a few minutes of starting (it needs `TMDB_API_KEY`); yt-dlp is installed
automatically.

---

# HomeFlix 5.5

A redesigned HomeFlix with a TV-first look, live TV, smarter downloads and
recommendations that learn from you.

## New

- **Apple TV-style redesign** across the web app, with faster page loads and a
  new player (Audio and Subtitles panel, smooth start).
- **Live TV**: free-to-air channels, including Bangladeshi news channels, with
  a guide, full-screen TV mode and automatic stream health checks.
- **Cast to the HomeFlix TV app** from the browser player.
- **For You**: recommendations, thumbs-up and thumbs-down ratings and Top 10
  charts based on what you actually watch.
- **What's New**: entertainment news and videos about the actors you watch,
  updated live.
- **Auto Download**: titles on My List download automatically, including
  upcoming movies and new episodes on release day.
- **Smart storage**: downloads go to the drive with room, move when a drive
  fills up, and pause when all drives are full. Cloud drives are supported
  through rclone.
- **Preview clips**: smaller and faster to make, taken from a lively scene,
  and kept within a size budget.
- **Settings**: reorganised, with Notifications, Live TV, Auto Download and
  Storage sections.
- **TV app updates**: publish TV app builds from Settings; TVs update
  themselves.

## Fixed

- Posters not loading until hovered, and several trailers playing sound at
  once.
- Casting failing with "Failed to fetch".
- The Storage page crashing after rclone was installed.
- Updates blocked by `go.mod` changes on the server.
- Downloads choosing an unplugged drive, and ignoring drive priority.

## Upgrading

Go to **Settings → Software Update → Upgrade to 5.5**.

If an update reports "local changes present", run this once in the HomeFlix
folder, then update again:

```bash
git checkout -- backend/go.mod backend/go.sum
```

After upgrading, review **Settings → Storage → Previews & Cache**. The
default preview budget is 15 GB; raise it if you want to keep more clips.
