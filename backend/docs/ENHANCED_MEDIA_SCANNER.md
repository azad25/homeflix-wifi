# Enhanced Media Scanner

## Overview

The media scanner has been significantly enhanced to support both title and filename-based searching when checking existing items. This improvement helps handle cases where files have been moved, renamed, or have mismatched titles, ensuring proper metadata and asset regeneration.

## Key Enhancements

### 1. Multi-Strategy Media Detection

The scanner now uses multiple strategies to find existing media:

1. **Path-based search** (fastest) - Exact path matching
2. **Filename-based search** - Handles path changes and file moves
3. **Title-based search** - Handles title changes and corrections
4. **Fuzzy search** - Catches edge cases with partial matches

### 2. Title-Filename Mismatch Detection

- Automatically detects when stored titles don't match expected titles from filenames
- Uses similarity algorithms to compare normalized titles
- Configurable similarity thresholds (70% for mismatch detection, 80% for exact matches, 60% for fuzzy matches)

### 3. Smart Asset Regeneration

- Forces asset regeneration when title-filename mismatches are detected
- Regenerates thumbnails, previews, and posters with corrected titles
- Preserves existing assets when no issues are detected

### 4. Enhanced Metadata Extraction

- Re-extracts metadata when title fixes are needed
- Preserves existing metadata when appropriate
- Improved title cleaning and validation

## New Types and Structures

### MediaSearchResult
```go
type MediaSearchResult struct {
    FoundBy        string // "path", "filename", "title", "fuzzy_title", "none"
    TitleMismatch  bool   // true if title doesn't match expected filename-based title
    PathChanged    bool   // true if file path has changed
    NeedsUpdate    bool   // true if metadata needs updating
}
```

### FileMetadata
```go
type FileMetadata struct {
    Title         string
    Type          string // "movie" or "episode"
    SeriesTitle   string
    SeasonNumber  *int
    EpisodeNumber *int
}
```

## New Methods

### Core Detection Methods
- `findExistingMedia()` - Multi-strategy media detection
- `detectTitleMismatch()` - Identifies title-filename mismatches
- `needsTitleFix()` - Determines if title regeneration is needed

### Search Methods
- `findMediaByTitle()` - Exact title matching
- `findMediaByTitleFuzzy()` - Fuzzy title matching
- `searchMediaByFilenamePattern()` - Filename pattern matching

### Utility Methods
- `normalizeTitleForComparison()` - Title normalization for comparison
- `calculateTitleSimilarity()` - Similarity calculation between titles
- `titleLooksLikeFilename()` - Detects uncleaned filename-like titles
- `extractExpectedTitle()` - Extracts expected title from path
- `cleanTitleForSearch()` - Prepares titles for search operations

## Processing Logic

### Enhanced Processing Flow

1. **Media Detection Phase**
   - Try path-based search first (fastest)
   - Fall back to filename-based search for moved files
   - Use title-based search for renamed files
   - Apply fuzzy search as last resort

2. **Analysis Phase**
   - Detect title-filename mismatches
   - Identify missing or outdated metadata
   - Check for missing assets
   - Determine required actions

3. **Update Phase**
   - Re-extract metadata if needed
   - Fix titles when mismatches are detected
   - Force asset regeneration when necessary
   - Update database records

### Smart Asset Management

- **Conditional Regeneration**: Assets are only regenerated when:
  - Title-filename mismatch is detected
  - Assets are missing
  - Title has been corrected
  - Metadata has been updated

- **Preservation**: Existing assets are preserved when:
  - No mismatches detected
  - Metadata is complete
  - Path hasn't changed

## Configuration

### Similarity Thresholds
- **Mismatch Detection**: 70% similarity threshold
- **Exact Title Search**: 80% similarity threshold  
- **Fuzzy Search**: 60% similarity threshold

### Search Patterns
- Common old path patterns for backward compatibility
- Configurable skip patterns for system files
- Enhanced filename cleaning patterns

## Benefits

1. **Handles File Moves**: Automatically detects and updates moved files
2. **Fixes Title Issues**: Corrects improperly extracted or stored titles
3. **Reduces Duplicates**: Prevents duplicate entries for the same media
4. **Improves Accuracy**: Better metadata extraction and validation
5. **Asset Consistency**: Ensures assets match current titles and metadata
6. **Performance**: Smart caching and conditional processing

## Usage

The enhanced scanner works automatically with existing scan operations:

```go
// Regular scan with enhanced detection
scanner.ScanMediaLibrary()

// Incremental scan with mismatch detection
scanner.IncrementalScan()

// Process single file with full analysis
scanner.ProcessSingleFile(path, info)
```

## Logging

Enhanced logging provides detailed information about:
- Detection strategy used ("Found by path/filename/title/fuzzy")
- Title-filename mismatches
- Asset regeneration decisions
- Metadata update operations
- Processing statistics

## Interface Updates

### MediaServiceInterface
Added new required methods:
- `SearchMedia(query string) ([]models.Media, error)`
- `GetAllMedia() ([]models.Media, error)`

### MediaMetadata
Enhanced with additional fields:
- `Status`, `IMDBID`, `Homepage`, `Collection`
- `Crew`, `Writers`, `Producers`

## Backward Compatibility

- All existing functionality preserved
- Existing media records are automatically analyzed and updated
- No breaking changes to public APIs
- Graceful fallbacks for missing services or data