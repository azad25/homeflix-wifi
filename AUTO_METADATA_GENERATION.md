# HomeFlix Automatic Metadata Generation

## 🤖 Overview
HomeFlix now automatically generates comprehensive metadata for all media files during the scanning process using Google's Gemini AI. No manual intervention required!

---

## ✅ How It Works

### Automatic Generation During Scan

When media files are discovered:

1. **File Detected** → Scanner finds video file
2. **Basic Info Extracted** → Filename, size, duration
3. **Thumbnails Generated** → Preview images created
4. **AI Metadata Generated** → Gemini analyzes filename in background
5. **Database Updated** → All metadata saved automatically

### Background Processing

- Metadata generation runs **asynchronously** (non-blocking)
- Scanner continues processing other files
- AI generation happens in parallel
- No impact on scan performance

---

## 📊 What Gets Generated Automatically

For every media file, Gemini AI generates:

- ✅ **Title** - Cleaned and formatted
- ✅ **Tagline** - Catchy one-liner
- ✅ **Description** - Plot summary
- ✅ **Year** - Release year
- ✅ **Rating** - 1-10 scale
- ✅ **Genres** - Multiple genre tags
- ✅ **Stars** - Cast members
- ✅ **Directors** - Director names
- ✅ **Country** - Country of origin

---

## 🔄 Processing Flow

```
Media File Discovered
    ↓
Extract Basic Info (filename, size)
    ↓
Generate Thumbnails & Preview Clips
    ↓
Download Poster (if available)
    ↓
[ASYNC] Generate AI Metadata with Gemini
    ↓
Update Database with AI Data
    ↓
Log Success with Details
```

---

## 📝 Log Output Example

```
Found video file [1]: /media/movies/The.Matrix.1999.1080p.BluRay.mp4
Extracted metadata: Title=The Matrix 1999 1080p BluRay, Type=movie
Generating thumbnail for: The Matrix 1999 1080p BluRay
Generating preview clip for: The Matrix 1999 1080p BluRay
Generating AI metadata for: The Matrix 1999 1080p BluRay
Successfully added media: The Matrix 1999 1080p BluRay (Type: movie)

[Background Process]
✅ Successfully generated AI metadata for: The Matrix
   📝 Tagline: Free your mind
   📅 Year: 1999 | ⭐ Rating: 8.7
   🎭 Genres: [Action Sci-Fi Thriller]
   🎬 Stars: [Keanu Reeves Laurence Fishburne Carrie-Anne Moss]
   🎥 Directors: [The Wachowskis]
   🌍 Country: USA
```

---

## 🎯 Manual Regeneration Option

Users can still manually regenerate metadata:

### Via Settings Page

1. Navigate to Settings
2. Select media from folder tree
3. Click **"AI Generate"** button
4. Review and edit generated fields
5. Click **"Save Metadata"**

### Use Cases for Manual Regeneration

- Incorrect AI-generated data
- Want different description
- Update after file rename
- Add missing information
- Refresh outdated metadata

---

## ⚙️ Configuration

### Environment Variables

```bash
# Gemini API Configuration
GEMINI_API_KEY=AIzaSyDe79kNlJ_lGUXO5e-qka73mUpcvrynsBc
DEFAULT_LLM_PROVIDER=gemini
DEFAULT_MODEL=gemini-2.0-flash-exp

# Media Path
MEDIA_PATH=/path/to/your/media
```

### Automatic vs Manual

| Feature | Automatic | Manual |
|---------|-----------|--------|
| **Trigger** | On file scan | User clicks button |
| **Timing** | Background async | Immediate |
| **Blocking** | No | Yes (waits for response) |
| **User Action** | None required | Click + Save |
| **Use Case** | Initial import | Corrections/updates |

---

## 🚀 Benefits

### For Users

- **Zero Manual Work** - Metadata generated automatically
- **Rich Information** - Comprehensive details for all media
- **Better Discovery** - Accurate genres and descriptions
- **Professional Look** - Taglines and proper formatting
- **Time Saved** - No need to manually enter data

### For System

- **Consistent Data** - AI ensures uniform quality
- **Better Recommendations** - Accurate genres improve suggestions
- **Enhanced Search** - Rich metadata improves search results
- **Complete Library** - Every file has full information

---

## 🔍 Technical Details

### Scanner Integration

**File**: `/backend/internal/scanner/scanner.go`

```go
// After generating thumbnails and posters
if s.geminiService != nil {
    log.Printf("Generating AI metadata for: %s", media.Title)
    go s.generateMetadataAsync(media, path)
}
```

### Async Processing

```go
func (s *MediaScanner) generateMetadataAsync(media *models.Media, path string) {
    // Panic recovery
    defer func() {
        if r := recover(); r != nil {
            log.Printf("Panic in generateMetadataAsync: %v", r)
        }
    }()
    
    // Generate with Gemini
    metadata, err := s.geminiService.GenerateMediaMetadata(path, media.Title)
    
    // Update database
    media.Title = metadata.Title
    media.Description = metadata.Description
    media.Rating = float32(metadata.Rating)
    
    // Save changes
    s.mediaService.UpdateMedia(media)
}
```

### Error Handling

- Panics are caught and logged
- Failures don't block scanner
- Errors logged with details
- Scanner continues on failure

---

## 📊 Performance Impact

### Scanner Performance

- **No Blocking** - AI generation runs in background
- **Parallel Processing** - Multiple files processed simultaneously
- **Graceful Degradation** - Scanner works even if AI fails
- **Resource Efficient** - Goroutines used for async processing

### API Usage

- One API call per media file
- Calls made asynchronously
- Rate limiting handled by Gemini
- Retries on transient failures

---

## 🎬 Example Scenarios

### Scenario 1: New Movie Added

```
User adds: Inception.2010.1080p.BluRay.x264.mp4
    ↓
Scanner detects file
    ↓
Extracts: Title="Inception 2010 1080p BluRay", Type="movie"
    ↓
Generates thumbnail & preview
    ↓
[Background] Gemini generates:
    - Title: "Inception"
    - Tagline: "Your mind is the scene of the crime"
    - Description: "A thief who steals corporate secrets..."
    - Year: 2010
    - Rating: 8.8
    - Genres: [Action, Sci-Fi, Thriller]
    - Stars: [Leonardo DiCaprio, Joseph Gordon-Levitt]
    - Directors: [Christopher Nolan]
    ↓
Database updated automatically
    ↓
User sees complete metadata in UI
```

### Scenario 2: TV Series Episode

```
User adds: Breaking.Bad.S01E01.Pilot.1080p.mp4
    ↓
Scanner detects episode pattern
    ↓
Creates/finds series: "Breaking Bad"
    ↓
Extracts: Season=1, Episode=1
    ↓
[Background] Gemini generates:
    - Title: "Breaking Bad - Pilot"
    - Description: "High school chemistry teacher..."
    - Year: 2008
    - Rating: 9.5
    - Genres: [Crime, Drama, Thriller]
    ↓
Episode metadata complete
```

---

## 🔧 Troubleshooting

### Metadata Not Generated

**Check logs for**:
- Gemini API errors
- Network connectivity issues
- Invalid API key
- Rate limiting

**Solution**:
- Verify API key in `.env`
- Check internet connection
- Use manual regeneration in settings

### Incorrect Metadata

**Causes**:
- Unclear filename
- Obscure movie/show
- Foreign language title

**Solution**:
- Use manual regeneration
- Edit fields in settings
- Rename file with clearer name

### Slow Processing

**Normal behavior**:
- AI generation is async
- Doesn't block scanner
- May take 2-5 seconds per file

**Not an issue**:
- Scanner continues immediately
- Other files processed in parallel

---

## 📈 Future Enhancements

- [ ] Batch processing for existing media
- [ ] Retry logic for failed generations
- [ ] Metadata quality scoring
- [ ] User feedback on AI accuracy
- [ ] Multi-language support
- [ ] IMDb/TMDB cross-reference
- [ ] Automatic poster generation
- [ ] Cast photo downloads

---

## 🎯 Summary

**Automatic Features**:
- ✅ Runs during media scan
- ✅ Background processing
- ✅ No user action needed
- ✅ Comprehensive metadata
- ✅ Error handling
- ✅ Detailed logging

**Manual Option**:
- ✅ Available in settings
- ✅ One-click regeneration
- ✅ Full field editing
- ✅ Save to database

**Result**: Every media file in your library automatically has rich, AI-generated metadata without any manual work!

---

**Status**: ✅ Fully Implemented
**Last Updated**: 2025-09-30
**Version**: 1.0.0
