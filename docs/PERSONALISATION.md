# Personalised recommendations

`GET /api/recommendations/for-you` returns rows such as "Top Picks for You", "Because You Watched / Liked …", "More with <actor>" and "Continue <collection>". The TV app (Home and the TV home-screen row) and the web app use these rows. The taste profile is built from three signals:

| Signal | Weight | Effect |
|---|---|---|
| **Watch history** (`playback_progresses`) | finished 1.0, half-watched 0.75, sampled 0.45; abandoned early counts slightly negative | Fades with a 45-day half-life. Bingeing a show strengthens it. |
| **Thumbs ratings** (`taste_ratings`) | love 1.6, like 1.0, not for me -1.2 | Liked titles count as seen and are not recommended back. They get "Because You Liked …" rows. "Not for me" titles are never recommended, not even in the fallback rows. |
| **My List** (`my_list_items`) | 0.5 | Steers recommendations towards similar titles. Listed titles can still be recommended. |

With no positive signal at all, the endpoint returns fallback rows ("Highly Rated", "Recently Added").

## Ratings API

`kind` is `movie` or `series`. Series are rated as a whole. The user comes from the `X-User-ID` header and defaults to `1`.

| Method | Path | Body / response |
|---|---|---|
| `GET` | `/api/ratings/{kind}/{id}` | `{"kind":"movie","id":12,"rating":1}` (`0` = not rated) |
| `PUT` / `POST` | `/api/ratings/{kind}/{id}` | body `{"rating": -1 \| 0 \| 1 \| 2}`: not for me, clear, like, love |
| `DELETE` | `/api/ratings/{kind}/{id}` | clears the rating |
| `GET` | `/api/ratings` | `{"ratings":[…]}`, newest first |

An unknown title answers `404`, and a rating outside -1…2 answers `400`.

## My List for whole shows

My List entries normally hold a media id. Add `?type=series` to store a whole show by its series id:

```
POST   /api/mylist/{seriesId}?type=series
DELETE /api/mylist/{seriesId}?type=series
GET    /api/mylist/check/{seriesId}?type=series   → {"in_list": true}
```

In `GET /api/mylist`, show entries have `"media_type": "series"` and a `series` object. Their `media` object is empty.
