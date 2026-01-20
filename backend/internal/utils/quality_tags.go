package utils

import (
	"regexp"
	"strings"
)

// QualityTag represents a quality/format tag with its display name and priority
type QualityTag struct {
	Tag      string
	Display  string
	Priority int // Higher priority tags are shown first
}

// Quality tags mapping with Netflix-style display names and priorities
var qualityTagsMap = map[string]QualityTag{
	// Video Quality
	"4K":     {Tag: "4K", Display: "4K", Priority: 100},
	"2160P":  {Tag: "2160P", Display: "4K", Priority: 100},
	"UHD":    {Tag: "UHD", Display: "UHD", Priority: 95},
	"1080P":  {Tag: "1080P", Display: "HD", Priority: 80},
	"720P":   {Tag: "720P", Display: "HD", Priority: 70},
	"HDR":    {Tag: "HDR", Display: "HDR", Priority: 90},
	"HDR10":  {Tag: "HDR10", Display: "HDR10", Priority: 92},
	"HDR10+": {Tag: "HDR10+", Display: "HDR10+", Priority: 94},
	"DV":     {Tag: "DV", Display: "Dolby Vision", Priority: 96},
	"DOLBY.VISION": {Tag: "DOLBY.VISION", Display: "Dolby Vision", Priority: 96},
	
	// Audio Quality
	"DOLBY":        {Tag: "DOLBY", Display: "Dolby", Priority: 85},
	"DOLBY.ATMOS":  {Tag: "DOLBY.ATMOS", Display: "Dolby Atmos", Priority: 88},
	"ATMOS":        {Tag: "ATMOS", Display: "Dolby Atmos", Priority: 88},
	"DTS":          {Tag: "DTS", Display: "DTS", Priority: 75},
	"DTS-HD":       {Tag: "DTS-HD", Display: "DTS-HD", Priority: 78},
	"DTS-X":        {Tag: "DTS-X", Display: "DTS:X", Priority: 82},
	"TRUEHD":       {Tag: "TRUEHD", Display: "TrueHD", Priority: 80},
	"DD+":          {Tag: "DD+", Display: "DD+", Priority: 65},
	"EAC3":         {Tag: "EAC3", Display: "DD+", Priority: 65},
	"AC3":          {Tag: "AC3", Display: "DD", Priority: 60},
	"AAC":          {Tag: "AAC", Display: "AAC", Priority: 55},
	
	// Video Codecs
	"HEVC":   {Tag: "HEVC", Display: "HEVC", Priority: 50},
	"H265":   {Tag: "H265", Display: "HEVC", Priority: 50},
	"H264":   {Tag: "H264", Display: "H.264", Priority: 45},
	"AVC":    {Tag: "AVC", Display: "H.264", Priority: 45},
	"VP9":    {Tag: "VP9", Display: "VP9", Priority: 48},
	"AV1":    {Tag: "AV1", Display: "AV1", Priority: 52},
	
	// Source/Release Type
	"BLURAY":     {Tag: "BLURAY", Display: "Blu-ray", Priority: 40},
	"REMUX":      {Tag: "REMUX", Display: "Remux", Priority: 42},
	"WEB-DL":     {Tag: "WEB-DL", Display: "WEB-DL", Priority: 35},
	"WEBDL":      {Tag: "WEBDL", Display: "WEB-DL", Priority: 35},
	"WEB":        {Tag: "WEB", Display: "WEB", Priority: 30},
	"WEBRIP":     {Tag: "WEBRIP", Display: "WEBRip", Priority: 28},
	"BRRIP":      {Tag: "BRRIP", Display: "BRRip", Priority: 25},
	"DVDRIP":     {Tag: "DVDRIP", Display: "DVDRip", Priority: 20},
	
	// Special Features
	"IMAX":       {Tag: "IMAX", Display: "IMAX", Priority: 87},
	"EXTENDED":   {Tag: "EXTENDED", Display: "Extended", Priority: 15},
	"UNCUT":      {Tag: "UNCUT", Display: "Uncut", Priority: 15},
	"REMASTERED": {Tag: "REMASTERED", Display: "Remastered", Priority: 15},
	"CRITERION":  {Tag: "CRITERION", Display: "Criterion", Priority: 18},
}

// ExtractQualityTags extracts quality tags from a filename
func ExtractQualityTags(filename string) []string {
	if filename == "" {
		return []string{}
	}
	
	// Convert to uppercase for matching
	upperFilename := strings.ToUpper(filename)
	
	// Remove file extension
	if lastDot := strings.LastIndex(upperFilename, "."); lastDot > 0 {
		upperFilename = upperFilename[:lastDot]
	}
	
	var foundTags []QualityTag
	tagSet := make(map[string]bool) // To avoid duplicates
	
	// Check for each quality tag
	for pattern, tag := range qualityTagsMap {
		// Create regex pattern to match the tag with word boundaries
		regexPattern := `\b` + regexp.QuoteMeta(pattern) + `\b`
		matched, err := regexp.MatchString(regexPattern, upperFilename)
		if err == nil && matched {
			// Avoid duplicate display names
			if !tagSet[tag.Display] {
				foundTags = append(foundTags, tag)
				tagSet[tag.Display] = true
			}
		}
	}
	
	// Special handling for common patterns
	
	// HDR variants
	if strings.Contains(upperFilename, "HDR10+") && !tagSet["HDR10+"] {
		foundTags = append(foundTags, qualityTagsMap["HDR10+"])
		tagSet["HDR10+"] = true
	} else if strings.Contains(upperFilename, "HDR10") && !tagSet["HDR10"] {
		foundTags = append(foundTags, qualityTagsMap["HDR10"])
		tagSet["HDR10"] = true
	} else if strings.Contains(upperFilename, "HDR") && !tagSet["HDR"] {
		foundTags = append(foundTags, qualityTagsMap["HDR"])
		tagSet["HDR"] = true
	}
	
	// Dolby Vision variants
	if (strings.Contains(upperFilename, "DOLBY.VISION") || strings.Contains(upperFilename, "DOLBYVISION") || 
		strings.Contains(upperFilename, "DV.")) && !tagSet["Dolby Vision"] {
		foundTags = append(foundTags, qualityTagsMap["DV"])
		tagSet["Dolby Vision"] = true
	}
	
	// Dolby Atmos variants
	if (strings.Contains(upperFilename, "DOLBY.ATMOS") || strings.Contains(upperFilename, "DOLBYATMOS") || 
		strings.Contains(upperFilename, "ATMOS")) && !tagSet["Dolby Atmos"] {
		foundTags = append(foundTags, qualityTagsMap["ATMOS"])
		tagSet["Dolby Atmos"] = true
	}
	
	// Resolution detection from numbers
	if strings.Contains(upperFilename, "2160") && !tagSet["4K"] {
		foundTags = append(foundTags, qualityTagsMap["2160P"])
		tagSet["4K"] = true
	} else if strings.Contains(upperFilename, "1080") && !tagSet["HD"] {
		foundTags = append(foundTags, qualityTagsMap["1080P"])
		tagSet["HD"] = true
	} else if strings.Contains(upperFilename, "720") && !tagSet["HD"] {
		foundTags = append(foundTags, qualityTagsMap["720P"])
		tagSet["HD"] = true
	}
	
	// Sort tags by priority (highest first)
	for i := 0; i < len(foundTags)-1; i++ {
		for j := i + 1; j < len(foundTags); j++ {
			if foundTags[i].Priority < foundTags[j].Priority {
				foundTags[i], foundTags[j] = foundTags[j], foundTags[i]
			}
		}
	}
	
	// Extract display names
	var result []string
	for _, tag := range foundTags {
		result = append(result, tag.Display)
	}
	
	// Limit to top 6 tags to avoid clutter
	if len(result) > 6 {
		result = result[:6]
	}
	
	return result
}

// GetQualityTagColor returns the appropriate color class for a quality tag
func GetQualityTagColor(tag string) string {
	switch strings.ToUpper(tag) {
	case "4K", "UHD":
		return "bg-purple-600/90 text-white border-purple-500/50"
	case "HDR", "HDR10", "HDR10+", "DOLBY VISION":
		return "bg-yellow-600/90 text-white border-yellow-500/50"
	case "DOLBY ATMOS", "DTS:X", "TRUEHD":
		return "bg-blue-600/90 text-white border-blue-500/50"
	case "IMAX":
		return "bg-red-600/90 text-white border-red-500/50"
	case "REMUX", "BLU-RAY":
		return "bg-green-600/90 text-white border-green-500/50"
	case "HEVC", "AV1":
		return "bg-indigo-600/90 text-white border-indigo-500/50"
	case "HD":
		return "bg-gray-600/90 text-white border-gray-500/50"
	default:
		return "bg-gray-700/90 text-white border-gray-600/50"
	}
}