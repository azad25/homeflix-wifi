package services

import (
	"fmt"

	"homeflix-backend/internal/models"
	"gorm.io/gorm"
)

type PageService struct {
	db *gorm.DB
}

func NewPageService(db *gorm.DB) *PageService {
	return &PageService{db: db}
}

func (s *PageService) Migrate() error {
	return models.MigratePageTables(s.db)
}

func (s *PageService) GetAllPages() ([]models.Page, error) {
	var pages []models.Page
	if err := s.db.Order("nav_order").Find(&pages).Error; err != nil {
		return nil, err
	}
	return pages, nil
}

func (s *PageService) GetNavPages() ([]models.Page, error) {
	var pages []models.Page
	if err := s.db.Where("is_nav_visible = ?", true).Order("nav_order").Find(&pages).Error; err != nil {
		return nil, err
	}
	return pages, nil
}

func (s *PageService) GetBySlug(slug string) (*models.Page, error) {
	var page models.Page
	if err := s.db.Where("slug = ?", slug).First(&page).Error; err != nil {
		return nil, err
	}
	return &page, nil
}

func (s *PageService) Create(page *models.Page) error {
	// assign nav order to last
	var maxOrder int
	s.db.Model(&models.Page{}).Select("COALESCE(MAX(nav_order), 0)").Scan(&maxOrder)
	page.NavOrder = maxOrder + 1
	return s.db.Create(page).Error
}

func (s *PageService) Update(slug string, updates map[string]interface{}) (*models.Page, error) {
	page, err := s.GetBySlug(slug)
	if err != nil {
		return nil, err
	}
	
	// If setting this page as home page, unset any other home page first
	if isHomePage, ok := updates["is_home_page"].(bool); ok && isHomePage {
		if err := s.db.Model(&models.Page{}).Where("is_home_page = ?", true).Update("is_home_page", false).Error; err != nil {
			return nil, fmt.Errorf("failed to unset previous home page: %w", err)
		}
		// Auto-hide from nav when set as home page
		updates["is_nav_visible"] = false
	} else if ok && !isHomePage {
		// When unsetting home page, restore nav visibility
		updates["is_nav_visible"] = true
	}
	
	if err := s.db.Model(page).Updates(updates).Error; err != nil {
		return nil, err
	}
	return page, nil
}

func (s *PageService) Delete(slug string) error {
	page, err := s.GetBySlug(slug)
	if err != nil {
		return err
	}
	// Optional: reassign widgets referencing this page to 'home'
	if err := s.db.Model(&models.Widget{}).Where("page = ?", page.Slug).Update("page", models.WidgetPageHome).Error; err != nil {
		return fmt.Errorf("failed to reassign widgets: %w", err)
	}
	return s.db.Delete(&models.Page{}, page.ID).Error
}

// GetHomePage returns the page marked as home page, or nil if none
func (s *PageService) GetHomePage() (*models.Page, error) {
	var page models.Page
	if err := s.db.Where("is_home_page = ?", true).First(&page).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &page, nil
}

// SetHomePage sets a page as the home page (unsets any previous home page)
func (s *PageService) SetHomePage(slug string) (*models.Page, error) {
	// Unset any existing home page
	if err := s.db.Model(&models.Page{}).Where("is_home_page = ?", true).Updates(map[string]interface{}{
		"is_home_page": false,
		"is_nav_visible": true,
	}).Error; err != nil {
		return nil, fmt.Errorf("failed to unset previous home page: %w", err)
	}
	
	// Set the new home page and hide from nav
	page, err := s.GetBySlug(slug)
	if err != nil {
		return nil, err
	}
	
	if err := s.db.Model(page).Updates(map[string]interface{}{
		"is_home_page": true,
		"is_nav_visible": false,
	}).Error; err != nil {
		return nil, err
	}
	
	return page, nil
}

// UnsetHomePage removes home page status from a page
func (s *PageService) UnsetHomePage(slug string) (*models.Page, error) {
	page, err := s.GetBySlug(slug)
	if err != nil {
		return nil, err
	}
	
	if err := s.db.Model(page).Updates(map[string]interface{}{
		"is_home_page": false,
		"is_nav_visible": true,
	}).Error; err != nil {
		return nil, err
	}
	
	return page, nil
}

