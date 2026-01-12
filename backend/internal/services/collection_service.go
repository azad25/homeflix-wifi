package services

import (
	"fmt"
	"homeflix-backend/internal/models"
	"gorm.io/gorm"
)

type CollectionService struct {
	db *gorm.DB
}

func NewCollectionService(db *gorm.DB) *CollectionService {
	return &CollectionService{db: db}
}

// Collection CRUD operations

func (s *CollectionService) CreateCollection(collection *models.Collection) error {
	return s.db.Create(collection).Error
}

func (s *CollectionService) GetCollectionByID(id uint) (*models.Collection, error) {
	var collection models.Collection
	err := s.db.Preload("Items").Preload("Items.Media").First(&collection, id).Error
	return &collection, err
}

func (s *CollectionService) GetCollectionsByUser(userID uint) ([]models.Collection, error) {
	var collections []models.Collection
	err := s.db.Where("user_id = ?", userID).Order("updated_at DESC").Find(&collections).Error
	return collections, err
}

func (s *CollectionService) GetPublicCollections() ([]models.Collection, error) {
	var collections []models.Collection
	err := s.db.Where("is_public = ?", true).Order("updated_at DESC").Find(&collections).Error
	return collections, err
}

func (s *CollectionService) UpdateCollection(id uint, updates map[string]interface{}) error {
	return s.db.Model(&models.Collection{}).Where("id = ?", id).Updates(updates).Error
}

func (s *CollectionService) DeleteCollection(id uint) error {
	return s.db.Delete(&models.Collection{}, id).Error
}

// Collection Item operations

func (s *CollectionService) AddItemToCollection(collectionID, mediaID uint, position int, notes string) error {
	// Check if item already exists in collection
	var existingItem models.CollectionItem
	err := s.db.Where("collection_id = ? AND media_id = ?", collectionID, mediaID).First(&existingItem).Error
	if err == nil {
		return fmt.Errorf("item already exists in collection")
	}

	// If position is 0, set it to the next available position
	if position == 0 {
		var maxPosition int
		s.db.Model(&models.CollectionItem{}).Where("collection_id = ?", collectionID).
			Select("COALESCE(MAX(position), 0)").Scan(&maxPosition)
		position = maxPosition + 1
	}

	item := &models.CollectionItem{
		CollectionID: collectionID,
		MediaID:      mediaID,
		Position:     position,
		Notes:        notes,
	}

	return s.db.Create(item).Error
}

func (s *CollectionService) RemoveItemFromCollection(collectionID, mediaID uint) error {
	return s.db.Where("collection_id = ? AND media_id = ?", collectionID, mediaID).
		Delete(&models.CollectionItem{}).Error
}

func (s *CollectionService) UpdateCollectionItemPosition(collectionID, mediaID uint, newPosition int) error {
	return s.db.Model(&models.CollectionItem{}).
		Where("collection_id = ? AND media_id = ?", collectionID, mediaID).
		Update("position", newPosition).Error
}

func (s *CollectionService) GetCollectionItems(collectionID uint) ([]models.CollectionItem, error) {
	var items []models.CollectionItem
	// Don't preload Media for now - handle missing media gracefully
	err := s.db.Where("collection_id = ?", collectionID).
		Order("position ASC").
		Find(&items).Error
	
	// For each item, try to load the media if it exists locally
	for i := range items {
		var media models.Media
		if err := s.db.First(&media, items[i].MediaID).Error; err == nil {
			items[i].Media = media
		}
		// If media doesn't exist locally (like TMDB content), leave Media empty
		// The frontend should handle this case
	}
	
	return items, err
}

// My List operations

func (s *CollectionService) AddToMyList(userID, mediaID uint, mediaType, notes string, priority int) error {
	// Check if item already exists in my list
	var existingItem models.MyListItem
	err := s.db.Where("user_id = ? AND media_id = ?", userID, mediaID).First(&existingItem).Error
	if err == nil {
		return fmt.Errorf("item already exists in my list")
	}

	item := &models.MyListItem{
		UserID:    userID,
		MediaID:   mediaID,
		MediaType: mediaType,
		Notes:     notes,
		Priority:  priority,
	}

	return s.db.Create(item).Error
}

func (s *CollectionService) RemoveFromMyList(userID, mediaID uint) error {
	return s.db.Where("user_id = ? AND media_id = ?", userID, mediaID).
		Delete(&models.MyListItem{}).Error
}

func (s *CollectionService) GetMyList(userID uint) ([]models.MyListItem, error) {
	var items []models.MyListItem
	// Don't preload Media for now - handle missing media gracefully
	err := s.db.Where("user_id = ?", userID).
		Order("priority DESC, added_at DESC").
		Find(&items).Error
	
	// For each item, try to load the media if it exists locally
	for i := range items {
		var media models.Media
		if err := s.db.First(&media, items[i].MediaID).Error; err == nil {
			items[i].Media = media
		}
		// If media doesn't exist locally (like TMDB content), leave Media empty
		// The frontend should handle this case
	}
	
	return items, err
}

func (s *CollectionService) IsInMyList(userID, mediaID uint) (bool, error) {
	var count int64
	err := s.db.Model(&models.MyListItem{}).
		Where("user_id = ? AND media_id = ?", userID, mediaID).
		Count(&count).Error
	return count > 0, err
}

func (s *CollectionService) UpdateMyListItem(userID, mediaID uint, updates map[string]interface{}) error {
	return s.db.Model(&models.MyListItem{}).
		Where("user_id = ? AND media_id = ?", userID, mediaID).
		Updates(updates).Error
}

// Collection Statistics

func (s *CollectionService) GetCollectionStats(collectionID uint) (*models.CollectionStats, error) {
	var stats models.CollectionStats

	// Get total items
	var totalItems int64
	s.db.Model(&models.CollectionItem{}).Where("collection_id = ?", collectionID).Count(&totalItems)
	stats.TotalItems = int(totalItems)

	// Get counts by media type and other stats
	rows, err := s.db.Raw(`
		SELECT 
			COUNT(CASE WHEN m.type = 'movie' THEN 1 END) as movie_count,
			COUNT(CASE WHEN m.type IN ('tv', 'series') THEN 1 END) as tv_show_count,
			COUNT(CASE WHEN m.type = 'episode' THEN 1 END) as episode_count,
			COALESCE(SUM(m.duration), 0) as total_duration,
			COALESCE(AVG(m.rating), 0) as avg_rating
		FROM collection_items ci
		JOIN media m ON ci.media_id = m.id
		WHERE ci.collection_id = ?
	`, collectionID).Rows()

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	if rows.Next() {
		err = rows.Scan(&stats.MovieCount, &stats.TVShowCount, &stats.EpisodeCount, 
			&stats.TotalDuration, &stats.AvgRating)
		if err != nil {
			return nil, err
		}
	}

	return &stats, nil
}

// Search collections

func (s *CollectionService) SearchCollections(query string, userID uint, includePublic bool) ([]models.Collection, error) {
	var collections []models.Collection
	
	db := s.db.Model(&models.Collection{})
	
	if includePublic {
		db = db.Where("(user_id = ? OR is_public = ?) AND (name ILIKE ? OR description ILIKE ?)", 
			userID, true, "%"+query+"%", "%"+query+"%")
	} else {
		db = db.Where("user_id = ? AND (name ILIKE ? OR description ILIKE ?)", 
			userID, "%"+query+"%", "%"+query+"%")
	}
	
	err := db.Order("updated_at DESC").Find(&collections).Error
	return collections, err
}

// Bulk operations

func (s *CollectionService) AddMultipleItemsToCollection(collectionID uint, mediaIDs []uint) error {
	// Get current max position
	var maxPosition int
	s.db.Model(&models.CollectionItem{}).Where("collection_id = ?", collectionID).
		Select("COALESCE(MAX(position), 0)").Scan(&maxPosition)

	// Create items in batch
	var items []models.CollectionItem
	for i, mediaID := range mediaIDs {
		// Check if item already exists
		var existingCount int64
		s.db.Model(&models.CollectionItem{}).
			Where("collection_id = ? AND media_id = ?", collectionID, mediaID).
			Count(&existingCount)
		
		if existingCount == 0 {
			items = append(items, models.CollectionItem{
				CollectionID: collectionID,
				MediaID:      mediaID,
				Position:     maxPosition + i + 1,
			})
		}
	}

	if len(items) > 0 {
		return s.db.Create(&items).Error
	}
	return nil
}

func (s *CollectionService) RemoveMultipleItemsFromCollection(collectionID uint, mediaIDs []uint) error {
	return s.db.Where("collection_id = ? AND media_id IN ?", collectionID, mediaIDs).
		Delete(&models.CollectionItem{}).Error
}

// Export/Import collections

func (s *CollectionService) ExportCollection(collectionID uint) (map[string]interface{}, error) {
	collection, err := s.GetCollectionByID(collectionID)
	if err != nil {
		return nil, err
	}

	items, err := s.GetCollectionItems(collectionID)
	if err != nil {
		return nil, err
	}

	export := map[string]interface{}{
		"collection": collection,
		"items":      items,
		"exported_at": fmt.Sprintf("%v", collection.UpdatedAt),
	}

	return export, nil
}

func (s *CollectionService) ImportCollection(userID uint, data map[string]interface{}) (*models.Collection, error) {
	// Parse collection data
	collectionData, ok := data["collection"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid collection data")
	}

	// Create new collection
	collection := &models.Collection{
		Name:        fmt.Sprintf("%v", collectionData["name"]),
		Description: fmt.Sprintf("%v", collectionData["description"]),
		UserID:      userID,
		IsPublic:    false, // Imported collections are private by default
	}

	err := s.CreateCollection(collection)
	if err != nil {
		return nil, err
	}

	// Import items if they exist
	if itemsData, ok := data["items"].([]interface{}); ok {
		for _, itemData := range itemsData {
			if item, ok := itemData.(map[string]interface{}); ok {
				if mediaID, ok := item["media_id"].(float64); ok {
					s.AddItemToCollection(collection.ID, uint(mediaID), 0, "")
				}
			}
		}
	}

	return collection, nil
}