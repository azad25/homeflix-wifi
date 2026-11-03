# TV app: the Home billboard plays the same background video for every show

**Seen in:** HomeFlix TV 5.15.2 (`azad25/homeflix-tv-app`, branch `v5`).

## Symptom

The Home billboard rotates through this year's newest additions. Every TV show
in it plays the same background video, and so does any title after the first
one that had a clip.

## Cause (client side)

The billboard asks the server for the right clip. `SeriesPreviews` picks each
show's newest episode, and `/api/series/:id/seasons/:n/episodes` returns only
that show's episodes. The fault is how the result is remembered:
`rememberPreviewUrl` in `app/src/main/java/com/homeflix/tv/core/SeriesPreviews.kt`:

```kotlin
return produceState(initialValue = tile.previewUrl, tile.key, active) {
    if (value != null || !active) return@produceState
    ...
}
```

`produceState` keeps its state in a plain `remember { }`. The keys only
restart the producer; they don't reset the value. `HeroBillboard` reuses the
same slot for every title, so it plays the first clip it finds for every
title after it. The producer sees `value != null` and stops before resolving
the new show. The rows don't have this problem because each tile has its own
slot.

## Fix (2 lines)

```kotlin
@Composable
fun rememberPreviewUrl(tile: Tile, active: Boolean): State<String?> {
    val resolver = LocalSeriesPreviews.current
    return produceState(initialValue = tile.previewUrl, tile.key, active) {
        value = tile.previewUrl                       // reset for this tile
        if (value != null || !active) return@produceState
        if (tile.kind == TileKind.SERIES && resolver != null) value = resolver.previewUrl(tile.seriesId ?: tile.id)
    }
}
```

Optionally, also give the billboard its own slot per title: wrap the
`rememberPreviewUrl(...)` call in `HeroBillboard` (`presentation/ui/Browse.kt`)
in `key(tile.key) { ... }`.

## Check

On Home, let the billboard rotate through at least two shows and one movie.
Each title should play its own clip; a show should play its newest uploaded
episode. Nothing on the server needs to change.
