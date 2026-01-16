#!/bin/bash
# DevOps AI Dashboard - Backup Script
# Usage: ./backup.sh [--output <path>] [--db-only] [--full]

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
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DB_ONLY=false
FULL_BACKUP=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --output)
            BACKUP_DIR="$2"
            shift 2
            ;;
        --db-only)
            DB_ONLY=true
            shift
            ;;
        --full)
            FULL_BACKUP=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --output <path>   Output directory for backup"
            echo "  --db-only         Backup only database"
            echo "  --full            Full backup including volumes"
            echo "  --help            Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Create backup directory
mkdir -p "$BACKUP_DIR"
BACKUP_PATH="$BACKUP_DIR/backup-$TIMESTAMP"
mkdir -p "$BACKUP_PATH"

# Backup database
backup_database() {
    log_info "Backing up database..."
    
    cd "$PROJECT_DIR"
    
    if ! docker compose ps db 2>/dev/null | grep -q "running"; then
        log_error "Database container is not running"
        return 1
    fi
    
    # Get database credentials from .env
    source "$PROJECT_DIR/.env" 2>/dev/null || true
    DB_USER="${DB_USER:-devops}"
    DB_NAME="${DB_NAME:-devops_dashboard}"
    
    # Dump database
    docker compose exec -T db pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_PATH/database.sql"
    
    # Compress
    gzip "$BACKUP_PATH/database.sql"
    
    log_success "Database backup: $BACKUP_PATH/database.sql.gz"
}

# Backup configuration files
backup_config() {
    log_info "Backing up configuration files..."
    
    mkdir -p "$BACKUP_PATH/config"
    
    # .env file
    if [[ -f "$PROJECT_DIR/.env" ]]; then
        cp "$PROJECT_DIR/.env" "$BACKUP_PATH/config/"
    fi
    
    # docker-compose.yml
    if [[ -f "$PROJECT_DIR/docker-compose.yml" ]]; then
        cp "$PROJECT_DIR/docker-compose.yml" "$BACKUP_PATH/config/"
    fi
    
    # nginx config
    if [[ -d "$PROJECT_DIR/nginx" ]]; then
        cp -r "$PROJECT_DIR/nginx" "$BACKUP_PATH/config/"
    fi
    
    # prometheus config
    if [[ -d "$PROJECT_DIR/prometheus" ]]; then
        cp -r "$PROJECT_DIR/prometheus" "$BACKUP_PATH/config/"
    fi
    
    # alertmanager config
    if [[ -d "$PROJECT_DIR/alertmanager" ]]; then
        cp -r "$PROJECT_DIR/alertmanager" "$BACKUP_PATH/config/"
    fi
    
    # grafana config
    if [[ -d "$PROJECT_DIR/grafana" ]]; then
        cp -r "$PROJECT_DIR/grafana" "$BACKUP_PATH/config/"
    fi
    
    log_success "Configuration backup completed"
}

# Backup Docker volumes
backup_volumes() {
    log_info "Backing up Docker volumes..."
    
    mkdir -p "$BACKUP_PATH/volumes"
    
    cd "$PROJECT_DIR"
    
    # Get volume names
    VOLUMES=$(docker compose config --volumes 2>/dev/null || echo "")
    
    for volume in $VOLUMES; do
        FULL_VOLUME_NAME="${PROJECT_DIR##*/}_${volume}"
        
        if docker volume inspect "$FULL_VOLUME_NAME" &>/dev/null; then
            log_info "Backing up volume: $volume"
            
            docker run --rm \
                -v "$FULL_VOLUME_NAME:/source:ro" \
                -v "$BACKUP_PATH/volumes:/backup" \
                alpine tar czf "/backup/${volume}.tar.gz" -C /source .
        fi
    done
    
    log_success "Volume backup completed"
}

# Backup git state
backup_git_state() {
    log_info "Backing up git state..."
    
    cd "$PROJECT_DIR"
    
    # Current commit
    git rev-parse HEAD > "$BACKUP_PATH/git-commit.txt"
    
    # Current branch
    git branch --show-current > "$BACKUP_PATH/git-branch.txt"
    
    # Uncommitted changes
    git diff > "$BACKUP_PATH/git-diff.patch" 2>/dev/null || true
    
    log_success "Git state backup completed"
}

# Create archive
create_archive() {
    log_info "Creating backup archive..."
    
    ARCHIVE_NAME="devops-dashboard-backup-$TIMESTAMP.tar.gz"
    ARCHIVE_PATH="$BACKUP_DIR/$ARCHIVE_NAME"
    
    cd "$BACKUP_DIR"
    tar czf "$ARCHIVE_NAME" "backup-$TIMESTAMP"
    
    # Remove uncompressed backup
    rm -rf "backup-$TIMESTAMP"
    
    # Calculate checksum
    sha256sum "$ARCHIVE_NAME" > "${ARCHIVE_NAME}.sha256"
    
    log_success "Backup archive created: $ARCHIVE_PATH"
    
    # Show size
    ARCHIVE_SIZE=$(du -h "$ARCHIVE_PATH" | cut -f1)
    log_info "Backup size: $ARCHIVE_SIZE"
}

# Cleanup old backups
cleanup_old_backups() {
    log_info "Cleaning up old backups..."
    
    # Keep only last 10 backups
    cd "$BACKUP_DIR"
    ls -t devops-dashboard-backup-*.tar.gz 2>/dev/null | tail -n +11 | xargs -r rm -f
    ls -t devops-dashboard-backup-*.tar.gz.sha256 2>/dev/null | tail -n +11 | xargs -r rm -f
    
    log_success "Cleanup completed"
}

# Main backup flow
main() {
    log_info "Starting DevOps AI Dashboard backup..."
    
    if [[ "$DB_ONLY" == "true" ]]; then
        backup_database
    else
        backup_database
        backup_config
        backup_git_state
        
        if [[ "$FULL_BACKUP" == "true" ]]; then
            backup_volumes
        fi
    fi
    
    create_archive
    cleanup_old_backups
    
    log_success "Backup completed successfully!"
}

# Run main
main
