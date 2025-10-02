Codec: H.264 (libx264) — baseline/main/high profile depending on devices. Use -profile:v high -level 4.1 for 1080p compatibility.

Keyframe/GOP: keyframes every 2 seconds. For 30fps → -g 60. For 24fps → -g 48. Also add -sc_threshold 0 to avoid scene-cut keyframes breaking alignment.

Segment length: 4 or 6 seconds (-hls_time 4 or 6). 4s reduces latency but increases requests.

Segment format: CMAF/fMP4 segments: -hls_segment_type fmp4 (better for modern players).

Rate control: use bitrate target + -maxrate + -bufsize. Example: for 3000k use -b:v 3000k -maxrate 3500k -bufsize 4200k.

Two-pass? Good for VBR quality; for many files, single-pass CRF is faster. For ABR, you’ll set explicit bitrates per variant (single-pass constrained VBR works well).

Audio: AAC LC -c:a aac -b:a 128k and same audio across variants.

Keyframe alignment across renditions: Use same -g, -keyint_min, -sc_threshold 0 and force keyframes (see ffmpeg expression below) so segment boundaries match. This avoids black frames when switching quality.

Minimal ffmpeg command — HLS with fMP4 (CMAF) for 3 bitrates

Drop this into your Celery ffmpeg task (update paths and values):

INPUT="/incoming/movie.mp4"
OUTDIR="/data/media/MovieName"
mkdir -p "$OUTDIR"
ffmpeg -y -i "$INPUT" -hide_banner -loglevel error \
  -preset fast -x264opts "keyint=48:min-keyint=48:no-scenecut" \
  -map 0:v -map 0:a \
  -c:a aac -ar 48000 -b:a 128k \
  -c:v:0 libx264 -b:v:0 4000k -maxrate:v:0 4400k -bufsize:v:0 6000k -vf "scale=1920:-2" -g 48 -keyint_min 48 -sc_threshold 0 \
  -c:v:1 libx264 -b:v:1 1800k -maxrate:v:1 1980k -bufsize:v:1 3600k -vf "scale=1280:-2" -g 48 -keyint_min 48 -sc_threshold 0 \
  -c:v:2 libx264 -b:v:2 800k  -maxrate:v:2 880k  -bufsize:v:2 1600k -vf "scale=854:-2"  -g 48 -keyint_min 48 -sc_threshold 0 \
  -f hls \
  -hls_time 4 \
  -hls_segment_type fmp4 \
  -hls_playlist_type vod \
  -hls_flags independent_segments \
  -master_pl_name master.m3u8 \
  -hls_segment_filename "$OUTDIR/stream_%v_$NUMBER$.m4s" \
  -var_stream_map "v:0,a:0 v:1,a:0 v:2,a:0" \
  "$OUTDIR/stream_%v.m3u8"


Notes:

-hls_segment_type fmp4 creates fMP4 segments (CMAF-like) instead of .ts.

-hls_time 4 = 4s segments.

-g 48 -keyint_min 48 aligns keyframes every 48 frames (~2s @24fps). Set 48 → adjust to frame rate fps * 2.

-hls_flags independent_segments helps segment isolation.

The produced files: master.m3u8 and variant .m3u8 playlists plus .m4s segments.

If you prefer .ts segments (legacy), drop -hls_segment_type fmp4 and change filenames to .ts.

Faster bulk encoding

Use hardware encoders:

NVENC: -c:v h264_nvenc and control -preset, -rc vbr_hq, etc.

QuickSync / VAAPI for Intel/AMD.

Hardware encoders are much faster but require tuning for quality/bitrate.

Compatibility notes

H.264 + AAC + HLS (m3u8 + fMP4 or .ts) will play in virtually all browsers with hls.js fallback for non-native HLS devices.

If you want very low-bandwidth delivery with modern clients, consider HEVC/AV1, but expect slower transcodes, less client support, and heavier CPU on decode for older devices.

Extra production tips (short)

Same audio & codec across variants so players can switch seamlessly.

Align keyframes across renditions.

Short segments (4–6s) give faster startup/seek.

CDN + cache-control for segments.

HTTP range support helps direct MP4 seeking (if you ever serve single MP4 files).

Generate poster, sprite, and VTT for scrubbing UX.

If you want, I’ll:

give you a full ffmpeg script that reads a config (resolutions/bitrates) and transcodes a directory, or

produce a version using NVENC for fast hardware transcodes.

Nice — for true 4K/HD streaming you need changes across **encoding**, **storage/network**, and **delivery**. Below I’ll give a compact checklist plus concrete, copy-pasteable `ffmpeg` examples (H.264 and a hardware HEVC path), bitrate ladders for 4K, server tuning tips, and a quick capacity formula so you know what bandwidth/storage you’ll need. All practical, no fluff.

---

# Big picture (what to change)

1. **Transcode to multi-bitrate ABR** including a 4K (2160p) variant. Use CMAF/fMP4 HLS or DASH.
2. **Prefer HEVC (h265) or AV1** for 4K if you control clients — huge bandwidth savings. Keep H.264 variants as compatibility fallback.
3. **Align keyframes across all renditions** (same GOP/keyint) so seamless ABR switching works.
4. **Short segments (4s)** and `independent_segments` so switching and startup are fast.
5. **Hardware transcode** (NVENC/QuickSync/AMD) for bulk 4K jobs; software x264/x265 is slow.
6. **Serve via nginx + CDN** (HTTP/2 or HTTP/3/QUIC preferred). Ensure `Accept-Ranges` and proper MIME types.
7. **Calculate bandwidth** required and size-up storage/IOPS — 4K files are large.

---

# Recommended 4K bitrate ladder (example)

(Use HEVC for efficiency; H.264 numbers are higher)

**HEVC (good quality / consumer):**

* 2160p (4K) — **12–25 Mbps** (Netflix ~15–25 Mbps)
* 1440p — **6–12 Mbps**
* 1080p — **4–8 Mbps**
* 720p — **2–4 Mbps**
* 480p — **0.8–1.5 Mbps**

**H.264 (if you must support older devices):**

* 2160p — **20–50 Mbps** (much higher than HEVC)
* 1440p — **10–18 Mbps**
* 1080p — **4–6 Mbps**
* 720p — **2–3 Mbps**

Audio: AAC-LC 128 kbps stereo (or 192 kbps for higher fidelity). Use same audio stream across variants.

---

# Key encoding rules (practical)

* **Codec:** HEVC/h265 (for 4K efficiency) + H.264 fallback.
* **Segment type:** `-hls_segment_type fmp4` (CMAF-like).
* **Segment length:** `-hls_time 4` (4s).
* **GOP/keyframes:** set GOP = ~2s (`-g fps*2`) and `-keyint_min` and `-sc_threshold 0` so no scene-cut misalignment.
* **Rate control:** set `-b:v`, `-maxrate`, and `-bufsize`.
* **Profiles/levels:** For H.264 4K use `-profile:v high -level 5.1` (or let encoder choose). For HEVC use main profile.
* **Audio same across renditions** so players can switch without rebuffer.

---

# ffmpeg examples

## A) Pure software, H.264 + CMAF (compatible)

(very compatible but large bandwidth for 4K)

```bash
INPUT="/incoming/movie.mp4"
OUT="/data/media/MovieName"
mkdir -p "$OUT"

ffmpeg -y -i "$INPUT" -hide_banner -loglevel error \
  -map 0:v -map 0:a \
  -c:a aac -ar 48000 -b:a 128k \
  -c:v:0 libx264 -b:v:0 40000k -maxrate:v:0 44000k -bufsize:v:0 88000k -vf "scale=3840:-2" -g 48 -keyint_min 48 -sc_threshold 0 \
  -c:v:1 libx264 -b:v:1 12000k -maxrate:v:1 13200k -bufsize:v:1 26400k -vf "scale=2560:-2" -g 48 -keyint_min 48 -sc_threshold 0 \
  -c:v:2 libx264 -b:v:2 6000k  -maxrate:v:2 6600k  -bufsize:v:2 13200k -vf "scale=1920:-2" -g 48 -keyint_min 48 -sc_threshold 0 \
  -c:v:3 libx264 -b:v:3 3000k  -maxrate:v:3 3300k  -bufsize:v:3 6600k  -vf "scale=1280:-2" -g 48 -keyint_min 48 -sc_threshold 0 \
  -f hls \
  -hls_time 4 \
  -hls_segment_type fmp4 \
  -hls_playlist_type vod \
  -hls_flags independent_segments \
  -master_pl_name master.m3u8 \
  -hls_segment_filename "$OUT/stream_%v_$NUMBER$.m4s" \
  -var_stream_map "v:0,a:0 v:1,a:0 v:2,a:0 v:3,a:0" \
  "$OUT/stream_%v.m3u8"
```

> Notes: 40,000k for 4K H.264 is big — use only if you need H.264-only playback.

## B) Hardware NVENC HEVC (fast + smaller files) — recommended for 4K

(NVIDIA GPU required; produces HEVC; much lower bitrate for same quality)

```bash
INPUT="/incoming/movie.mp4"
OUT="/data/media/MovieName"
mkdir -p "$OUT"

ffmpeg -y -hwaccel auto -i "$INPUT" -hide_banner -loglevel error \
  -map 0:v -map 0:a \
  -c:a aac -ar 48000 -b:a 128k \
  -c:v:0 hevc_nvenc -preset p6 -rc vbr_hq -cq 19 -b:v:0 16000k -maxrate:v:0 18000k -bufsize:v:0 24000k -vf "scale=3840:-2" -g 48 -keyint_min 48 -sc_threshold 0 \
  -c:v:1 hevc_nvenc -preset p6 -rc vbr_hq -cq 22 -b:v:1 8000k  -maxrate:v:1 9000k  -bufsize:v:1 12000k -vf "scale=2560:-2" -g 48 -keyint_min 48 -sc_threshold 0 \
  -c:v:2 hevc_nvenc -preset p6 -rc vbr_hq -cq 24 -b:v:2 4000k  -maxrate:v:2 4400k  -bufsize:v:2 6000k  -vf "scale=1920:-2" -g 48 -keyint_min 48 -sc_threshold 0 \
  -f hls \
  -hls_time 4 \
  -hls_segment_type fmp4 \
  -hls_playlist_type vod \
  -hls_flags independent_segments \
  -master_pl_name master.m3u8 \
  -hls_segment_filename "$OUT/stream_%v_$NUMBER$.m4s" \
  -var_stream_map "v:0,a:0 v:1,a:0 v:2,a:0" \
  "$OUT/stream_%v.m3u8"
```

> HEVC (hevc_nvenc) allows 4K at ~12–18 Mbps with same perceived quality vs H.264 30–50 Mbps.

---

# Delivery & server tuning

* **nginx**: enable `sendfile on; tcp_nopush on; tcp_nodelay on; keepalive_timeout 65;` and ensure large `worker_connections`. Turn off gzip for media paths.
* **MIME types** for fMP4/m3u8/ts set correctly.
* **Cache-Control:** `public, max-age=31536000, immutable` for segments if immutable names.
* **Use CDN** (Cloudflare, CloudFront) or Vevo-like edge caching for segments. For LAN-only you can use Nginx + reverse-proxy with caching.
* **HTTP/3 / QUIC**: benefits multiplexing and reduces head-of-line blocking for many small segments; try to use CDNs or servers supporting HTTP/3.
* **Range requests & CORS** must be enabled.

---

# Storage & network capacity

* **Concurrent bandwidth calc**: `required_bandwidth_mbps = sum(average_bitrate_of_each_concurrent_stream)`
  Example: 10 concurrent 4K HEVC streams at 15 Mbps = 150 Mbps outbound.
* **Disk throughput/IOPS**: serving many concurrent 4K segments requires good disk throughput. Use SSD-backed object store (S3/MinIO on NVMe) or CDN edge.
* **Transcoding storage**: keep both source and transcoded outputs. 4K outputs consume large space (minutes × bitrate). Estimate: 15 Mbps ≈ 1.875 MB/s → ~112.5 MB/min → ~6.75 GB/hr per 4K stream stored.
* **Memory**: edge servers/proxies need enough sockets/connections for concurrency.

---

# Player considerations (Next.js + hls.js)

* Detect client decoding capability: prefer HEVC only if client supports it; otherwise load H.264 fallback.
* Limit initial download: start with lower-bitrate stream and switch up.
* Increase buffer / bufferLength to avoid rebuffering for 4K.
* Prefer `hls.js` with `capLevelToPlayerSize:true` to avoid loading 4K on small displays.

---

# Compatibility strategy (recommended)

* **Primary pack**: HEVC (CMAF/fMP4) renditions for 4K/1440p/1080p/720p.
* **Fallback pack**: H.264 renditions (1080p and lower). Provide manifest logic or use master playlist that lists both codecs; player selects supported ones.
* **Transcode once per source** and store outputs—don’t transcode on-the-fly for 4K unless you have heavy GPU farm.

---

# Quick action plan for you (next steps)

1. Choose hardware encoder (NVidia GPU or cloud instance with NVENC) or accept slower x265 CPU transcodes.
2. Start producing HEVC CMAF outputs (use example B). Keep H.264 1080p/720p fallback if many old devices.
3. Serve with nginx + CDN, enable HTTP/3 if possible.
4. Update player to prefer HEVC but fallback to H.264, and save resume/telemetry.

---

If you want, I’ll:

* paste a **full docker-compose + ffmpeg-transcoder worker** that uses NVENC and writes fMP4 HLS outputs to `/data/media`, **and** a small Next.js player config that auto-selects HEVC/H.264.

I can drop that right now — tell me and I’ll provide the files.
