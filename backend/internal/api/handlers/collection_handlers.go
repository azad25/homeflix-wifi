package handlers

import (
	"net/http"
	"strconv"
	"homeflix-backend/internal/models"
	"homeflix-backend/internal/services"
	"github.com/gin-gonic/gin"
)

type CollectionHandlers struct {
	collectionService *services.CollectionService
}

func NewCollectionHandlers(collectionService *services.CollectionService) *CollectionHandlers {
	return &CollectionHandlers{
		collectionService: collectionService,
	}
}

// Collection CRUD handlers

func (h *CollectionHandlers) CreateCollection(c *gin.Context) {
	var collection models.Collection
	if err := c.ShouldBindJSON(&collection); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Set user ID from header or default
	userID := getUserIDFromContext(c)
	collection.UserID = userID

	if err := h.collectionService.CreateCollection(&collection); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, collection)
}

func (h *CollectionHandlers) GetCollection(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid collection ID"})
		return
	}

	collection, err := h.collectionService.GetCollectionByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Collection not found"})
		return
	}

	c.JSON(http.StatusOK, collection)
}

func (h *CollectionHandlers) GetUserCollections(c *gin.Context) {
	userID := getUserIDFromContext(c)
	
	collections, err := h.collectionService.GetCollectionsByUser(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, collections)
}

func (h *CollectionHandlers) GetPublicCollections(c *gin.Context) {
	collections, err := h.collectionService.GetPublicCollections()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, collections)
}

func (h *CollectionHandlers) UpdateCollection(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid collection ID"})
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.collectionService.UpdateCollection(uint(id), updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Collection updated successfully"})
}

func (h *CollectionHandlers) DeleteCollection(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid collection ID"})
		return
	}

	if err := h.collectionService.DeleteCollection(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Collection deleted successfully"})
}

// Collection Item handlers

func (h *CollectionHandlers) AddItemToCollection(c *gin.Context) {
	collectionID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid collection ID"})
		return
	}

	var request struct {
		MediaID   uint   `json:"media_id" binding:"required"`
		MediaType string `json:"media_type"` // Add media_type support
		Position  int    `json:"position"`
		Notes     string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Set default media type if not provided
	if request.MediaType == "" {
		request.MediaType = "movie"
	}

	if err := h.collectionService.AddItemToCollection(uint(collectionID), request.MediaID, request.Position, request.Notes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Item added to collection successfully"})
}

func (h *CollectionHandlers) RemoveItemFromCollection(c *gin.Context) {
	collectionID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid collection ID"})
		return
	}

	mediaID, err := strconv.ParseUint(c.Param("mediaId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
		return
	}

	if err := h.collectionService.RemoveItemFromCollection(uint(collectionID), uint(mediaID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Item removed from collection successfully"})
}

func (h *CollectionHandlers) GetCollectionItems(c *gin.Context) {
	collectionID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid collection ID"})
		return
	}

	items, err := h.collectionService.GetCollectionItems(uint(collectionID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, items)
}

// My List handlers

func (h *CollectionHandlers) AddToMyList(c *gin.Context) {
	mediaID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
		return
	}

	userID := getUserIDFromContext(c)

	var request struct {
		MediaType string `json:"media_type"`
		Notes     string `json:"notes"`
		Priority  int    `json:"priority"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		// Set defaults if no body provided
		request.MediaType = "movie"
		request.Priority = 0
	}

	if err := h.collectionService.AddToMyList(userID, uint(mediaID), request.MediaType, request.Notes, request.Priority); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Item added to My List successfully"})
}

func (h *CollectionHandlers) RemoveFromMyList(c *gin.Context) {
	mediaID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
		return
	}

	userID := getUserIDFromContext(c)

	if err := h.collectionService.RemoveFromMyList(userID, uint(mediaID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Item removed from My List successfully"})
}

func (h *CollectionHandlers) GetMyList(c *gin.Context) {
	userID := getUserIDFromContext(c)

	items, err := h.collectionService.GetMyList(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, items)
}

func (h *CollectionHandlers) CheckMyList(c *gin.Context) {
	mediaID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
		return
	}

	userID := getUserIDFromContext(c)

	inList, err := h.collectionService.IsInMyList(userID, uint(mediaID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"in_list": inList})
}

// Collection Statistics

func (h *CollectionHandlers) GetCollectionStats(c *gin.Context) {
	collectionID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid collection ID"})
		return
	}

	stats, err := h.collectionService.GetCollectionStats(uint(collectionID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// Search Collections

func (h *CollectionHandlers) SearchCollections(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Search query is required"})
		return
	}

	userID := getUserIDFromContext(c)
	includePublic := c.Query("include_public") == "true"

	collections, err := h.collectionService.SearchCollections(query, userID, includePublic)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, collections)
}

// Bulk Operations

func (h *CollectionHandlers) AddMultipleItemsToCollection(c *gin.Context) {
	collectionID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid collection ID"})
		return
	}

	var request struct {
		MediaIDs []uint `json:"media_ids" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.collectionService.AddMultipleItemsToCollection(uint(collectionID), request.MediaIDs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Items added to collection successfully"})
}

// Export/Import

func (h *CollectionHandlers) ExportCollection(c *gin.Context) {
	collectionID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid collection ID"})
		return
	}

	export, err := h.collectionService.ExportCollection(uint(collectionID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, export)
}

func (h *CollectionHandlers) ImportCollection(c *gin.Context) {
	userID := getUserIDFromContext(c)

	var importData map[string]interface{}
	if err := c.ShouldBindJSON(&importData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	collection, err := h.collectionService.ImportCollection(userID, importData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, collection)
}

// Helper function to get user ID from context
func getUserIDFromContext(c *gin.Context) uint {
	// Try to get user ID from header
	if userIDStr := c.GetHeader("X-User-ID"); userIDStr != "" {
		if userID, err := strconv.ParseUint(userIDStr, 10, 32); err == nil {
			return uint(userID)
		}
	}
	
	// Default to user ID 1 for now
	return 1
}