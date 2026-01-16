#!/bin/bash
# =============================================================================
# DevOps AI Dashboard - Production Deployment Script
# =============================================================================
# Usage: ./scripts/deploy.sh [OPTIONS]
#
# Options:
#   --version VERSION    Deploy specific version (tag)
#   --rollback           Rollback to previous version
#   --force              Skip confirmation prompts
#   --dry-run            Show what would be done without executing
#   --health-only        Only run health checks
#   --backup             Create backup before deployment
#   --no-backup          Skip backup creation
#   --notify             Send deployment notifications
#   -h, --help           Show this help message
# =============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.yml"
BACKUP_DIR="${PROJECT_DIR}/backups"
LOG_FILE="${PROJECT_DIR}/logs/deploy.log"
HEALTH_URL="http://localhost:3000/api/health"
MAX_HEALTH_RETRIES=10
HEALTH_RETRY_DELAY=10

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default options
VERSION=""
ROLLBACK=false
FORCE=false
DRY_RUN=false
HEALTH_ONLY=false
CREATE_BACKUP=true
NOTIFY=false

# =============================================================================
# Helper Functions
# =============================================================================

log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        INFO)  color=$GREEN ;;
        WARN)  color=$YELLOW ;;
        ERROR) color=$RED ;;
        *)     color=$NC ;;
    esac
    
    echo -e "${color}[${timestamp}] [${level}] ${message}${NC}"
    echo "[${timestamp}] [${level}] ${message}" >> "$LOG_FILE"
}

show_help() {
    head -25 "$0" | tail -20
    exit 0
}

check_prerequisites() {
    log INFO "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log ERROR "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        log ERROR "Docker Compose is not available"
        exit 1
    fi
    
    # Check if compose file exists
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log ERROR "docker-compose.yml not found at $COMPOSE_FILE"
        exit 1
    fi
    
    log INFO "Prerequisites check passed"
}

get_current_version() {
    docker compose -f "$COMPOSE_FILE" exec -T app cat /app/package.json 2>/dev/null | jq -r .version || echo "unknown"
}

create_backup() {
    if [[ "$CREATE_BACKUP" != true ]]; then
        log INFO "Skipping backup (--no-backup specified)"
        return 0
    fi
    
    log INFO "Creating backup..."
    
    mkdir -p "$BACKUP_DIR"
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local backup_file="${BACKUP_DIR}/backup_${timestamp}.tar.gz"
    
    # Backup database
    log INFO "Backing up database..."
    docker compose -f "$COMPOSE_FILE" exec -T db pg_dump -U postgres devops_dashboard > "${BACKUP_DIR}/db_${timestamp}.sql" 2>/dev/null || true
    
    # Backup configuration
    log INFO "Backing up configuration..."
    tar -czf "$backup_file" \
        --exclude='node_modules' \
        --exclude='dist' \
        --exclude='backups' \
        --exclude='.git' \
        -C "$PROJECT_DIR" . 2>/dev/null || true
    
    # Keep only last 5 backups
    ls -t "${BACKUP_DIR}"/backup_*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm -f
    ls -t "${BACKUP_DIR}"/db_*.sql 2>/dev/null | tail -n +6 | xargs -r rm -f
    
    log INFO "Backup created: $backup_file"
}

health_check() {
    log INFO "Running health check..."
    
    for i in $(seq 1 $MAX_HEALTH_RETRIES); do
        if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
            log INFO "Health check passed (attempt $i)"
            return 0
        fi
        log WARN "Health check failed (attempt $i/$MAX_HEALTH_RETRIES), retrying in ${HEALTH_RETRY_DELAY}s..."
        sleep $HEALTH_RETRY_DELAY
    done
    
    log ERROR "Health check failed after $MAX_HEALTH_RETRIES attempts"
    return 1
}

deploy() {
    local target_version=$1
    
    log INFO "Starting deployment..."
    log INFO "Target version: ${target_version:-latest}"
    
    if [[ "$DRY_RUN" == true ]]; then
        log INFO "[DRY RUN] Would deploy version: $target_version"
        return 0
    fi
    
    # Pull latest code
    log INFO "Pulling latest code..."
    cd "$PROJECT_DIR"
    git fetch --all --tags --prune
    
    if [[ -n "$target_version" ]]; then
        git checkout "v$target_version" 2>/dev/null || git checkout "$target_version"
    else
        git checkout main
        git pull origin main
    fi
    
    # Pull new images
    log INFO "Pulling Docker images..."
    docker compose -f "$COMPOSE_FILE" pull
    
    # Blue-green deployment
    log INFO "Starting blue-green deployment..."
    
    # Scale up new instances
    docker compose -f "$COMPOSE_FILE" up -d --no-deps --scale app=2 app
    sleep 15
    
    # Check new instances
    if health_check; then
        log INFO "New instances healthy, scaling down old..."
        docker compose -f "$COMPOSE_FILE" up -d --no-deps --scale app=1 app
    else
        log ERROR "New instances unhealthy!"
        return 1
    fi
    
    # Final update
    docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
    
    # Cleanup
    log INFO "Cleaning up old images..."
    docker image prune -f
    
    log INFO "Deployment completed successfully!"
}

rollback() {
    log INFO "Starting rollback..."
    
    if [[ "$DRY_RUN" == true ]]; then
        log INFO "[DRY RUN] Would rollback to previous version"
        return 0
    fi
    
    # Find latest backup
    local latest_backup=$(ls -t "${BACKUP_DIR}"/db_*.sql 2>/dev/null | head -1)
    
    if [[ -z "$latest_backup" ]]; then
        log WARN "No database backup found, rolling back code only"
    fi
    
    cd "$PROJECT_DIR"
    
    # Rollback to previous commit
    git checkout HEAD~1
    
    # Pull images for that version
    docker compose -f "$COMPOSE_FILE" pull
    
    # Restart services
    docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
    
    # Restore database if backup exists
    if [[ -n "$latest_backup" ]]; then
        log INFO "Restoring database from $latest_backup..."
        docker compose -f "$COMPOSE_FILE" exec -T db psql -U postgres devops_dashboard < "$latest_backup" || true
    fi
    
    log INFO "Rollback completed"
}

send_notification() {
    local status=$1
    local message=$2
    
    if [[ "$NOTIFY" != true ]]; then
        return 0
    fi
    
    # Slack notification (if webhook URL is set)
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local emoji="✅"
        [[ "$status" == "error" ]] && emoji="❌"
        [[ "$status" == "warning" ]] && emoji="⚠️"
        
        curl -sf -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-type: application/json' \
            -d "{\"text\": \"$emoji DevOps AI Dashboard: $message\"}" || true
    fi
    
    # Discord notification (if webhook URL is set)
    if [[ -n "${DISCORD_WEBHOOK_URL:-}" ]]; then
        curl -sf -X POST "$DISCORD_WEBHOOK_URL" \
            -H 'Content-type: application/json' \
            -d "{\"content\": \"DevOps AI Dashboard: $message\"}" || true
    fi
}

# =============================================================================
# Main
# =============================================================================

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --version)
            VERSION="$2"
            shift 2
            ;;
        --rollback)
            ROLLBACK=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --health-only)
            HEALTH_ONLY=true
            shift
            ;;
        --backup)
            CREATE_BACKUP=true
            shift
            ;;
        --no-backup)
            CREATE_BACKUP=false
            shift
            ;;
        --notify)
            NOTIFY=true
            shift
            ;;
        -h|--help)
            show_help
            ;;
        *)
            log ERROR "Unknown option: $1"
            show_help
            ;;
    esac
done

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

log INFO "=========================================="
log INFO "DevOps AI Dashboard Deployment"
log INFO "=========================================="

# Check prerequisites
check_prerequisites

# Get current version
CURRENT_VERSION=$(get_current_version)
log INFO "Current version: $CURRENT_VERSION"

# Health check only mode
if [[ "$HEALTH_ONLY" == true ]]; then
    if health_check; then
        log INFO "System is healthy"
        exit 0
    else
        log ERROR "System is unhealthy"
        exit 1
    fi
fi

# Rollback mode
if [[ "$ROLLBACK" == true ]]; then
    if [[ "$FORCE" != true ]]; then
        read -p "Are you sure you want to rollback? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log INFO "Rollback cancelled"
            exit 0
        fi
    fi
    
    send_notification "warning" "Starting rollback from v$CURRENT_VERSION"
    
    if rollback; then
        send_notification "success" "Rollback completed successfully"
        exit 0
    else
        send_notification "error" "Rollback failed!"
        exit 1
    fi
fi

# Deployment mode
if [[ "$FORCE" != true && "$DRY_RUN" != true ]]; then
    read -p "Deploy ${VERSION:-latest} to production? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log INFO "Deployment cancelled"
        exit 0
    fi
fi

send_notification "info" "Starting deployment of ${VERSION:-latest}"

# Create backup
create_backup

# Deploy
if deploy "$VERSION"; then
    # Final health check
    if health_check; then
        NEW_VERSION=$(get_current_version)
        log INFO "=========================================="
        log INFO "Deployment successful!"
        log INFO "Previous version: $CURRENT_VERSION"
        log INFO "New version: $NEW_VERSION"
        log INFO "=========================================="
        send_notification "success" "Deployment successful! v$CURRENT_VERSION → v$NEW_VERSION"
        exit 0
    else
        log ERROR "Post-deployment health check failed!"
        send_notification "error" "Deployment health check failed, initiating rollback..."
        rollback
        exit 1
    fi
else
    log ERROR "Deployment failed!"
    send_notification "error" "Deployment failed, initiating rollback..."
    rollback
    exit 1
fi
