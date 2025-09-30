# HomeFlix Gemini AI Integration - Complete Guide

## 🤖 Overview
HomeFlix now features AI-powered metadata generation and recommendations using Google's Gemini 2.0 Flash model.

---

## ✅ Features Implemented

### 1. Automatic Metadata Generation
- **AI-Powered Analysis**: Gemini analyzes movie filenames and generates comprehensive metadata
- **One-Click Generation**: Click "AI Generate" button in settings
- **Comprehensive Fields**:
  - Title (cleaned and formatted)
  - Tagline (catchy one-liner)
  - Description (detailed plot summary)
  - Release Year
  - Cast (Stars/Actors)
  - Directors
  - Country of Origin
  - Genres
  - Rating (1-10 scale)

### 2. Smart Recommendations
- **AI-Driven Suggestions**: Gemini analyzes viewing patterns
- **Context-Aware**: Considers current media, genres, watch history
- **Personalized**: Returns 10 tailored recommendations

### 3. Enhanced Settings Page
- **Folder Tree Navigation**: Browse media library hierarchically
- **Real-Time Editing**: Edit all metadata fields
- **Add/Remove Lists**: Manage stars, directors, genres
- **Auto-Save**: Save changes to database

---

## 🔧 Configuration

### Environment Variables
```bash
# Required
GEMINI_API_KEY=AIzaSyDe79kNlJ_lGUXO5e-qka73mUpcvrynsBc
DEFAULT_LLM_PROVIDER=gemini
DEFAULT_MODEL=gemini-2.0-flash-exp

# Optional
PORT=8251
DATABASE_URL=homeflix.db
```

### API Key Setup
1. The Gemini API key is pre-configured
2. Model: `gemini-2.0-flash-exp` (latest flash model)
3. Fallback to environment variable if needed

---

## 📡 API Endpoints

### Generate Metadata
```http
POST /api/ai/generate-metadata/:id
```

**Response**:
```json
{
  "title": "The Matrix",
  "tagline": "Free your mind",
  "description": "A computer hacker learns about the true nature of reality...",
  "year": 1999,
  "stars": ["Keanu Reeves", "Laurence Fishburne", "Carrie-Anne Moss"],
  "directors": ["The Wachowskis"],
  "country": "USA",
  "genres": ["Action", "Sci-Fi"],
  "rating": 8.7
}
```

### Get Recommendations
```http
POST /api/ai/recommendations
Content-Type: application/json

{
  "title": "The Matrix",
  "genres": ["Action", "Sci-Fi"],
  "watch_history": ["Inception", "Blade Runner"]
}
```

**Response**:
```json
{
  "recommendations": [
    "The Matrix Reloaded",
    "Ghost in the Shell",
    "Blade Runner 2049",
    ...
  ]
}
```

### Update Metadata
```http
PUT /api/admin/media/:id/metadata
Content-Type: application/json

{
  "title": "Updated Title",
  "tagline": "New tagline",
  "description": "Updated description",
  "year": 2024,
  "stars": ["Actor 1", "Actor 2"],
  "directors": ["Director Name"],
  "country": "USA",
  "rating": 8.5
}
```

---

## 🎯 Usage Workflow

### Automatic Metadata Generation

1. **Navigate to Settings**
   - Go to Settings page
   - See folder tree on left side

2. **Select Media**
   - Browse Movies or TV Shows folders
   - Click on a media item

3. **Generate Metadata**
   - Click "AI Generate" button (purple gradient)
   - Wait for Gemini to analyze (shows spinner)
   - Review generated metadata

4. **Edit & Customize**
   - Modify any field as needed
   - Add/remove stars, directors, genres
   - Adjust rating, year, country

5. **Save Changes**
   - Click "Save Metadata" button (green)
   - Changes saved to database
   - Metadata appears on info pages

### How It Works

1. **Filename Analysis**
   - Gemini receives the media filename
   - Analyzes patterns, year indicators, quality markers
   - Extracts meaningful information

2. **AI Processing**
   - Sends prompt to Gemini API
   - Requests structured JSON response
   - Parses and validates data

3. **Metadata Extraction**
   - Removes markdown code blocks
   - Extracts JSON from response
   - Validates all fields

4. **Database Update**
   - Stores metadata in media record
   - Updates title, description, rating
   - Maintains relationships (genres, etc.)

---

## 🔍 Technical Details

### Gemini Service (`gemini_service.go`)

**Key Functions**:
- `GenerateMediaMetadata()` - Main metadata generation
- `GenerateRecommendations()` - AI recommendations
- `callGemini()` - API communication
- `extractJSON()` - Response parsing

**Prompt Engineering**:
```go
prompt := fmt.Sprintf(`Analyze this media file and generate comprehensive metadata in JSON format.

Filename: %s
Existing Title: %s

Generate the following information:
1. Title (clean, proper title)
2. Tagline (catchy one-liner)
3. Description (detailed plot summary, 2-3 sentences)
4. Year (release year, estimate if unknown)
5. Stars (main actors/actresses, array of names)
6. Directors (director names, array)
7. Country (country of origin)
8. Genres (array of genre tags)
9. Rating (estimated rating 1-10)

Return ONLY valid JSON...`, filename, existingTitle)
```

### Error Handling
- API timeout handling
- JSON parsing fallbacks
- Markdown extraction
- Empty response handling
- Rate limiting awareness

### Response Processing
1. Receives Gemini response
2. Extracts JSON from markdown blocks
3. Unmarshals to struct
4. Validates required fields
5. Returns structured data

---

## 🎨 Frontend Integration

### Enhanced Settings Page (`enhanced-page.tsx`)

**Components Used**:
- `FolderTree` - Hierarchical navigation
- `MagneticButton` - AI Generate button
- `GradientBackground` - Cosmic theme
- `ScrollReveal` - Smooth animations

**State Management**:
```typescript
const [metadata, setMetadata] = useState<MediaMetadata>({
  title: '',
  tagline: '',
  description: '',
  year: new Date().getFullYear(),
  stars: [],
  directors: [],
  country: '',
  genres: [],
  rating: 0,
});
```

**AI Generation Flow**:
```typescript
const generateMetadata = async () => {
  setGeneratingMetadata(true);
  const response = await fetch(
    `${getApiUrl()}/api/ai/generate-metadata/${selectedMedia.id}`,
    { method: 'POST' }
  );
  const data = await response.json();
  setMetadata(data);
  setGeneratingMetadata(false);
};
```

---

## 📊 Data Flow

```
User Clicks Media
    ↓
Load Existing Metadata
    ↓
User Clicks "AI Generate"
    ↓
Frontend → POST /api/ai/generate-metadata/:id
    ↓
Backend → Gemini API
    ↓
Gemini Analyzes Filename
    ↓
Returns JSON Metadata
    ↓
Backend Parses & Validates
    ↓
Frontend Displays Fields
    ↓
User Edits (Optional)
    ↓
User Clicks "Save"
    ↓
Frontend → PUT /api/admin/media/:id/metadata
    ↓
Backend Updates Database
    ↓
Success Response
```

---

## 🚀 Testing Guide

### Test Metadata Generation

1. **Start Backend**:
```bash
cd backend
go run main.go
```

2. **Start Frontend**:
```bash
cd frontend
npm run dev
```

3. **Test Flow**:
   - Navigate to http://localhost:3000/settings
   - Select a movie from folder tree
   - Click "AI Generate"
   - Verify metadata appears
   - Edit fields
   - Click "Save Metadata"
   - Check database for updates

### Test API Directly

```bash
# Generate metadata
curl -X POST http://localhost:8251/api/ai/generate-metadata/1

# Get recommendations
curl -X POST http://localhost:8251/api/ai/recommendations \
  -H "Content-Type: application/json" \
  -d '{
    "title": "The Matrix",
    "genres": ["Action", "Sci-Fi"],
    "watch_history": ["Inception"]
  }'

# Update metadata
curl -X PUT http://localhost:8251/api/admin/media/1/metadata \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title",
    "description": "New description",
    "rating": 8.5
  }'
```

---

## 🎯 Best Practices

### Filename Conventions
For best AI results, use descriptive filenames:
- ✅ `The.Matrix.1999.1080p.BluRay.x264.mp4`
- ✅ `Inception (2010) [1080p].mkv`
- ❌ `movie1.mp4`
- ❌ `vid_20240101.avi`

### Metadata Quality
- Review AI-generated data before saving
- Add missing cast/crew manually
- Verify release year accuracy
- Adjust ratings based on preference

### API Usage
- Gemini API has rate limits
- Cache generated metadata
- Don't regenerate unnecessarily
- Handle API errors gracefully

---

## 🔮 Future Enhancements

- [ ] Batch metadata generation
- [ ] Multi-language support
- [ ] IMDb/TMDB integration
- [ ] Poster generation with AI
- [ ] Trailer analysis
- [ ] Subtitle generation
- [ ] Content warnings detection
- [ ] Similar movies clustering

---

## 📝 Notes

- Gemini API key is pre-configured
- Model: `gemini-2.0-flash-exp` (fast, efficient)
- JSON responses are validated and sanitized
- Markdown code blocks are automatically removed
- All metadata is optional and editable
- Changes are saved to SQLite database

---

**Status**: ✅ Fully Implemented and Tested
**Last Updated**: 2025-09-30
**Version**: 1.0.0
