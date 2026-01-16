#!/bin/bash
# DevOps AI Dashboard - Update Script
# Usage: ./update.sh [--force] [--no-backup]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_DIR}/backups"
FORCE_UPDATE=false
CREATE_BACKUP=true

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE_UPDATE=true
            shift
            ;;
        --no-backup)
            CREATE_BACKUP=false
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --force       Force update even if no changes detected"
            echo "  --no-backup   Skip creating backup before update"
            echo "  --help        Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check if running from correct directory
check_directory() {
    if [[ ! -f "$PROJECT_DIR/docker-compose.yml" ]]; then
        log_error "docker-compose.yml not found. Are you in the correct directory?"
        exit 1
    fi
}

# Create backup
create_backup() {
    if [[ "$CREATE_BACKUP" != "true" ]]; then
        log_warning "Skipping backup as requested"
        return
    fi
    
    log_info "Creating backup..."
    
    mkdir -p "$BACKUP_DIR"
    
    BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
    
    mkdir -p "$BACKUP_PATH"
    
    # Backup .env file
    if [[ -f "$PROJECT_DIR/.env" ]]; then
        cp "$PROJECT_DIR/.env" "$BACKUP_PATH/"
    fi
    
    # Backup current commit hash
    cd "$PROJECT_DIR"
    git rev-parse HEAD > "$BACKUP_PATH/commit.txt"
    
    # Backup database (if running)
    if docker compose ps db 2>/dev/null | grep -q "running"; then
        log_info "Backing up database..."
        docker compose exec -T db pg_dump -U devops devops_dashboard > "$BACKUP_PATH/database.sql" 2>/dev/null || true
    fi
    
    log_success "Backup created at $BACKUP_PATH"
}

# Check for updates
check_updates() {
    log_info "Checking for updates..."
    
    cd "$PROJECT_DIR"
    
    # Fetch latest changes
    git fetch origin
    
    # Get current and remote commits
    CURRENT_COMMIT=$(git rev-parse HEAD)
    REMOTE_COMMIT=$(git rev-parse origin/main)
    
    if [[ "$CURRENT_COMMIT" == "$REMOTE_COMMIT" ]]; then
        if [[ "$FORCE_UPDATE" == "true" ]]; then
            log_warning "No changes detected, but forcing update..."
            return 0
        else
            log_success "Already up to date!"
            exit 0
        fi
    fi
    
    # Show changes
    log_info "Changes detected:"
    git log --oneline HEAD..origin/main
    
    return 0
}

# Pull latest changes
pull_changes() {
    log_info "Pulling latest changes..."
    
    cd "$PROJECT_DIR"
    
    # Stash any local changes
    git stash 2>/dev/null || true
    
    # Pull changes
    git pull origin main
    
    log_success "Changes pulled successfully"
}

# Rebuild and restart services
rebuild_services() {
    log_info "Rebuilding and restarting services..."
    
    cd "$PROJECT_DIR"
    
    # Stop services
    docker compose down
    
    # Rebuild
    docker compose build --no-cache
    
    # Start services
    docker compose up -d
    
    log_success "Services rebuilt and restarted"
}

# Health check
health_check() {
    log_info "Performing health check..."
    
    local max_attempts=30
    local attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
            log_success "Application is healthy"
            return 0
        fi
        
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    
    log_error "Health check failed"
    return 1
}

# Rollback function
rollback() {
    log_error "Update failed! Rolling back..."
    
    if [[ -z "$BACKUP_PATH" ]] || [[ ! -d "$BACKUP_PATH" ]]; then
        log_error "No backup available for rollback"
        exit 1
    fi
    
    cd "$PROJECT_DIR"
    
    # Get previous commit
    if [[ -f "$BACKUP_PATH/commit.txt" ]]; then
        PREVIOUS_COMMIT=$(cat "$BACKUP_PATH/commit.txt")
        git reset --hard "$PREVIOUS_COMMIT"
    fi
    
    # Rebuild with previous version
    docker compose down
    docker compose build
    docker compose up -d
    
    log_warning "Rolled back to previous version"
}

# Main update flow
main() {
    log_info "Starting DevOps AI Dashboard update..."
    
    check_directory
    create_backup
    check_updates
    pull_changes
    
    # Rebuild with error handling
    if ! rebuild_services; then
        rollback
        exit 1
    fi
    
    # Health check with rollback on failure
    if ! health_check; then
        rollback
        exit 1
    fi
    
    log_success "Update completed successfully!"
    
    # Show new version
    cd "$PROJECT_DIR"
    NEW_COMMIT=$(git rev-parse --short HEAD)
    log_info "Current version: $NEW_COMMIT"
}

# Run main
main
