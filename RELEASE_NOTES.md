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
