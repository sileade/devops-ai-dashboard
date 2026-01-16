#!/bin/bash
# DevOps AI Dashboard - Restore Script
# Usage: ./restore.sh <backup-file.tar.gz>

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
RESTORE_DB=true
RESTORE_CONFIG=true
RESTORE_VOLUMES=false

# Check arguments
if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <backup-file.tar.gz> [options]"
    echo ""
    echo "Options:"
    echo "  --db-only         Restore only database"
    echo "  --config-only     Restore only configuration"
    echo "  --with-volumes    Also restore Docker volumes"
    echo "  --help            Show this help message"
    exit 1
fi

BACKUP_FILE="$1"
shift

# Parse additional arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --db-only)
            RESTORE_DB=true
            RESTORE_CONFIG=false
            shift
            ;;
        --config-only)
            RESTORE_DB=false
            RESTORE_CONFIG=true
            shift
            ;;
        --with-volumes)
            RESTORE_VOLUMES=true
            shift
            ;;
        --help)
            echo "Usage: $0 <backup-file.tar.gz> [options]"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Verify backup file
verify_backup() {
    log_info "Verifying backup file..."
    
    if [[ ! -f "$BACKUP_FILE" ]]; then
        log_error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi
    
    # Check checksum if available
    CHECKSUM_FILE="${BACKUP_FILE}.sha256"
    if [[ -f "$CHECKSUM_FILE" ]]; then
        log_info "Verifying checksum..."
        if ! sha256sum -c "$CHECKSUM_FILE" &>/dev/null; then
            log_error "Checksum verification failed!"
            exit 1
        fi
        log_success "Checksum verified"
    else
        log_warning "No checksum file found, skipping verification"
    fi
}

# Extract backup
extract_backup() {
    log_info "Extracting backup..."
    
    TEMP_DIR=$(mktemp -d)
    tar xzf "$BACKUP_FILE" -C "$TEMP_DIR"
    
    # Find backup directory
    BACKUP_DIR=$(find "$TEMP_DIR" -maxdepth 1 -type d -name "backup-*" | head -1)
    
    if [[ -z "$BACKUP_DIR" ]]; then
        log_error "Invalid backup format"
        rm -rf "$TEMP_DIR"
        exit 1
    fi
    
    log_success "Backup extracted to $TEMP_DIR"
}

# Stop services
stop_services() {
    log_info "Stopping services..."
    
    cd "$PROJECT_DIR"
    docker compose down 2>/dev/null || true
    
    log_success "Services stopped"
}

# Restore database
restore_database() {
    if [[ "$RESTORE_DB" != "true" ]]; then
        return
    fi
    
    log_info "Restoring database..."
    
    DB_BACKUP="$BACKUP_DIR/database.sql.gz"
    
    if [[ ! -f "$DB_BACKUP" ]]; then
        log_warning "No database backup found, skipping"
        return
    fi
    
    cd "$PROJECT_DIR"
    
    # Start only database
    docker compose up -d db
    
    # Wait for database to be ready
    log_info "Waiting for database to be ready..."
    sleep 10
    
    # Get database credentials
    source "$PROJECT_DIR/.env" 2>/dev/null || true
    DB_USER="${DB_USER:-devops}"
    DB_NAME="${DB_NAME:-devops_dashboard}"
    
    # Drop and recreate database
    docker compose exec -T db psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS $DB_NAME;" postgres
    docker compose exec -T db psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;" postgres
    
    # Restore
    gunzip -c "$DB_BACKUP" | docker compose exec -T db psql -U "$DB_USER" "$DB_NAME"
    
    log_success "Database restored"
}

# Restore configuration
restore_config() {
    if [[ "$RESTORE_CONFIG" != "true" ]]; then
        return
    fi
    
    log_info "Restoring configuration..."
    
    CONFIG_DIR="$BACKUP_DIR/config"
    
    if [[ ! -d "$CONFIG_DIR" ]]; then
        log_warning "No configuration backup found, skipping"
        return
    fi
    
    # Restore .env (with confirmation)
    if [[ -f "$CONFIG_DIR/.env" ]]; then
        if [[ -f "$PROJECT_DIR/.env" ]]; then
            log_warning "Existing .env file will be overwritten"
            read -p "Continue? [y/N] " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_info "Skipping .env restore"
            else
                cp "$CONFIG_DIR/.env" "$PROJECT_DIR/.env"
                chmod 600 "$PROJECT_DIR/.env"
            fi
        else
            cp "$CONFIG_DIR/.env" "$PROJECT_DIR/.env"
            chmod 600 "$PROJECT_DIR/.env"
        fi
    fi
    
    # Restore other configs
    for dir in nginx prometheus alertmanager grafana; do
        if [[ -d "$CONFIG_DIR/$dir" ]]; then
            cp -r "$CONFIG_DIR/$dir" "$PROJECT_DIR/"
        fi
    done
    
    log_success "Configuration restored"
}

# Restore volumes
restore_volumes() {
    if [[ "$RESTORE_VOLUMES" != "true" ]]; then
        return
    fi
    
    log_info "Restoring Docker volumes..."
    
    VOLUMES_DIR="$BACKUP_DIR/volumes"
    
    if [[ ! -d "$VOLUMES_DIR" ]]; then
        log_warning "No volume backup found, skipping"
        return
    fi
    
    cd "$PROJECT_DIR"
    
    for volume_file in "$VOLUMES_DIR"/*.tar.gz; do
        if [[ -f "$volume_file" ]]; then
            VOLUME_NAME=$(basename "$volume_file" .tar.gz)
            FULL_VOLUME_NAME="${PROJECT_DIR##*/}_${VOLUME_NAME}"
            
            log_info "Restoring volume: $VOLUME_NAME"
            
            # Create volume if not exists
            docker volume create "$FULL_VOLUME_NAME" 2>/dev/null || true
            
            # Restore data
            docker run --rm \
                -v "$FULL_VOLUME_NAME:/target" \
                -v "$volume_file:/backup.tar.gz:ro" \
                alpine sh -c "rm -rf /target/* && tar xzf /backup.tar.gz -C /target"
        fi
    done
    
    log_success "Volumes restored"
}

# Restore git state
restore_git_state() {
    log_info "Restoring git state..."
    
    if [[ -f "$BACKUP_DIR/git-commit.txt" ]]; then
        COMMIT=$(cat "$BACKUP_DIR/git-commit.txt")
        log_info "Backup was from commit: $COMMIT"
        
        cd "$PROJECT_DIR"
        
        # Check if we should reset to this commit
        read -p "Reset to backup commit $COMMIT? [y/N] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git fetch origin
            git reset --hard "$COMMIT"
            log_success "Git state restored"
        else
            log_info "Keeping current git state"
        fi
    fi
}

# Start services
start_services() {
    log_info "Starting services..."
    
    cd "$PROJECT_DIR"
    docker compose up -d
    
    log_success "Services started"
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
    
    log_warning "Health check timeout - application may still be starting"
}

# Cleanup
cleanup() {
    log_info "Cleaning up..."
    rm -rf "$TEMP_DIR"
}

# Main restore flow
main() {
    log_info "Starting DevOps AI Dashboard restore..."
    
    verify_backup
    extract_backup
    stop_services
    restore_config
    restore_database
    restore_volumes
    restore_git_state
    start_services
    health_check
    cleanup
    
    log_success "Restore completed successfully!"
}

# Run main
main
