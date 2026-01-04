package handlers

import (
	"net/http"

	"homeflix-backend/internal/models"
	"homeflix-backend/internal/services"
	"github.com/gin-gonic/gin"
)

type PageHandler struct {
	service *services.PageService
}

func NewPageHandler(service *services.PageService) *PageHandler {
	return &PageHandler{service: service}
}

func (h *PageHandler) List(c *gin.Context) {
	pages, err := h.service.GetAllPages()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, pages)
}

func (h *PageHandler) Nav(c *gin.Context) {
	pages, err := h.service.GetNavPages()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, pages)
}

func (h *PageHandler) Get(c *gin.Context) {
	slug := c.Param("slug")
	if slug == "" { c.JSON(http.StatusBadRequest, gin.H{"error": "slug required"}); return }
	page, err := h.service.GetBySlug(slug)
	if err != nil { c.JSON(http.StatusNotFound, gin.H{"error": "page not found"}); return }
	c.JSON(http.StatusOK, page)
}

func (h *PageHandler) Create(c *gin.Context) {
	var input models.Page
	if err := c.ShouldBindJSON(&input); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }
	if input.Slug == "" || input.Title == "" { c.JSON(http.StatusBadRequest, gin.H{"error": "slug and title required"}); return }
	if err := h.service.Create(&input); err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusCreated, input)
}

func (h *PageHandler) Update(c *gin.Context) {
	slug := c.Param("slug")
	if slug == "" { c.JSON(http.StatusBadRequest, gin.H{"error": "slug required"}); return }
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }
	page, err := h.service.Update(slug, updates)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, page)
}

func (h *PageHandler) Delete(c *gin.Context) {
	slug := c.Param("slug")
	if slug == "" { c.JSON(http.StatusBadRequest, gin.H{"error": "slug required"}); return }
	if err := h.service.Delete(slug); err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *PageHandler) GetHomePage(c *gin.Context) {
	page, err := h.service.GetHomePage()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if page == nil {
		c.JSON(http.StatusOK, gin.H{"home_page": nil})
		return
	}
	c.JSON(http.StatusOK, page)
}

