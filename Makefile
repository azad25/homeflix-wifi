# HomeFlix Development Makefile
# Platform-independent commands for development and deployment

.PHONY: help dev prod stop clean logs health build test

# Default target
help: ## Show this help message
	@echo "HomeFlix Development Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Environment Variables:"
	@echo "  MEDIA_PATH     Path to your media files"
	@echo "  BUILD_TARGET   development or production (default: development)"
	@echo ""

# Environment setup
setup: ## Setup environment and dependencies
	@echo "🔧 Setting up HomeFlix environment..."
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "📋 Created .env file from .env.example"; \
		echo "⚠️  Please edit .env file with your configuration"; \
	fi
	@chmod +x start-dev.sh start-prod.sh
	@echo "✅ Environment setup complete"

# Development commands
dev: setup ## Start development environment with hot reloading
	@echo "🚀 Starting development environment..."
	@BUILD_TARGET=development ./start-dev.sh

dev-build: ## Rebuild and start development environment
	@echo "🔨 Rebuilding development environment..."
	@BUILD_TARGET=development docker-compose down
	@BUILD_TARGET=development docker-compose build --no-cache
	@BUILD_TARGET=development ./start-dev.sh

# Production commands
prod: setup ## Start production environment
	@echo "🏭 Starting production environment..."
	@BUILD_TARGET=production ./start-prod.sh

prod-build: ## Rebuild and start production environment
	@echo "🔨 Rebuilding production environment..."
	@BUILD_TARGET=production docker-compose down --remove-orphans
	@BUILD_TARGET=production docker-compose build --no-cache
	@BUILD_TARGET=production ./start-prod.sh

# Service management
stop: ## Stop all services
	@echo "🛑 Stopping all services..."
	@docker-compose down

clean: ## Stop services and remove volumes
	@echo "🧹 Cleaning up all containers and volumes..."
	@docker-compose down --volumes --remove-orphans
	@docker system prune -f

restart: ## Restart all services
	@echo "🔄 Restarting services..."
	@docker-compose restart

# Monitoring and debugging
logs: ## Show logs for all services
	@docker-compose logs -f

logs-backend: ## Show backend logs
	@docker-compose logs -f backend

logs-celery: ## Show all Celery worker logs
	@docker-compose logs -f celery-metadata celery-thumbnails celery-posters celery-video celery-subtitles celery-scanning

logs-redis: ## Show Redis logs
	@docker-compose logs -f redis

status: ## Show service status
	@echo "📊 Service Status:"
	@docker-compose ps
	@echo ""
	@echo "🔍 Health Checks:"
	@echo -n "Backend:  "; curl -s -o /dev/null -w "%{http_code}" http://localhost:8251/health 2>/dev/null || echo "Failed"
	@echo -n "Frontend: "; curl -s -o /dev/null -w "%{http_code}" http://localhost:3006 2>/dev/null || echo "Failed"
	@echo -n "Flower:   "; curl -s -o /dev/null -w "%{http_code}" http://localhost:5555 2>/dev/null || echo "Failed"

health: ## Run health checks on all services
	@echo "🏥 Running health checks..."
	@docker-compose exec backend curl -f http://localhost:8251/health || echo "❌ Backend health check failed"
	@docker-compose exec redis redis-cli ping || echo "❌ Redis health check failed"
	@curl -f http://localhost:5555 > /dev/null 2>&1 && echo "✅ Flower is healthy" || echo "❌ Flower health check failed"

# Database and media management
scan: ## Trigger media library scan
	@echo "🔍 Triggering media library scan..."
	@curl -X POST http://localhost:8251/api/scan || echo "❌ Failed to trigger scan"

db-reset: ## Reset database (WARNING: This will delete all data)
	@echo "⚠️  This will delete all database data. Are you sure? [y/N]"
	@read -r response; \
	if [ "$$response" = "y" ] || [ "$$response" = "Y" ]; then \
		docker-compose exec backend rm -f /app/homeflix.db; \
		docker-compose restart backend; \
		echo "🗑️  Database reset complete"; \
	else \
		echo "❌ Database reset cancelled"; \
	fi

# Development utilities
shell-backend: ## Open shell in backend container
	@docker-compose exec backend /bin/bash

shell-redis: ## Open Redis CLI
	@docker-compose exec redis redis-cli

# Testing
test: ## Run tests
	@echo "🧪 Running tests..."
	@docker-compose exec backend go test ./...

# Build commands
build: ## Build all images
	@echo "🔨 Building all images..."
	@docker-compose build

build-backend: ## Build only backend image
	@echo "🔨 Building backend image..."
	@docker-compose build backend

build-frontend: ## Build only frontend image
	@echo "🔨 Building frontend image..."
	@docker-compose build frontend

# Quick access URLs
urls: ## Show all service URLs
	@echo "🌐 HomeFlix Service URLs:"
	@echo "  Frontend:         http://localhost:3006"
	@echo "  Backend API:      http://localhost:8251"
	@echo "  API Health:       http://localhost:8251/health"
	@echo "  Flower Dashboard: http://localhost:5555"
	@echo "  Redis:            localhost:6380"
