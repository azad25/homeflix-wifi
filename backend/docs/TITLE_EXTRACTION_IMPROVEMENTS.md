# Title Extraction Improvements

## Overview
This document outlines the improvements made to the title extraction system to better handle movie filenames and improve TMDB search accuracy.

## Key Improvements

### 1. Enhanced Title Cleaning
- **Better pattern recognition**: Improved detection of quality indicators, release groups, and technical specifications
- **Year handling**: Extracts year from filename and includes it in the final title while using it separately for TMDB search
- **Release group detection**: Added support for common release groups like "Hasan", "YIFY", "RARBG", etc.

### 2. TMDB Search Optimization
- **Dual approach**: Final title includes year for display, but TMDB search uses title without year for better matching
- **Multiple search strategies**: 
  1. Search with clean title + year parameter
  2. Search with clean title without year parameter
  3. Fallback to simple title extraction
  4. Final fallback without year constraint

### 3. Improved Fallback Logic
- **No more "Unknown Movie" prefixes**: Replaced generic fallbacks with proper filename-based extraction
- **TMDB service integration**: Scanner now uses TMDB service's CleanTitle method for consistent results
- **Bad title detection**: TMDB service detects and fixes titles that already have "Unknown Movie" prefixes

### 4. Quality Detection
- **Automatic quality detection**: Detects 4K, QHD, Full HD, HD, SD, 360p from filenames
- **Source-based quality**: Considers BluRay, WEB sources for quality determination
- **Fallback to HD**: Default quality when no specific resolution is found

## Examples

### Before
```
Input: "Top Gun Maverick 2022 1080p WEB-RIP H265 HEVC AAC2.0-[Hasan].mkv"
Output: "Unknown Movie - Top Gun Maverick 2022 1080p WEB-RIP H265 HEVC AAC2.0-[Hasan]"
TMDB Search: "Unknown Movie Top Gun Maverick" (fails)
```

### After
```
Input: "Top Gun Maverick 2022 1080p WEB-RIP H265 HEVC AAC2.0-[Hasan].mkv"
Output: "Top Gun Maverick (2022)"
TMDB Search: "Top Gun Maverick" with year 2022 (succeeds)
Quality: "Full HD"
```

## Technical Details

### Title Cleaning Process
1. Extract year from filename
2. Replace separators with spaces
3. Cut at first quality/technical indicator
4. Remove brackets and parentheses
5. Remove remaining quality indicators
6. Remove release groups
7. Clean up spaces and apply title case
8. Add year back to final title

### TMDB Search Process
1. Clean title using enhanced algorithm
2. Remove year from cleaned title for search
3. Use year as separate search parameter
4. Try multiple search strategies with fallbacks
5. Return enhanced metadata with proper title including year

## Files Modified
- `backend/internal/services/tmdb_service.go`: Enhanced title cleaning and TMDB search
- `backend/internal/scanner/scanner.go`: Improved fallback logic and TMDB integration
- `backend/internal/interfaces/scanner_interfaces.go`: Unified MediaMetadata interface
- `backend/internal/services/gemini_service.go`: Updated to use unified interface

## Testing
Run the test script to verify improvements:
```bash
cd backend
go run scripts/test_top_gun_fix.go
```

This will show the before/after comparison for various filename patterns.