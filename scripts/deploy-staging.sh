#!/bin/bash
# =============================================================================
# DevOps AI Dashboard - Staging Deployment Script
# =============================================================================
# Usage: ./scripts/deploy-staging.sh [OPTIONS]
#
# Options:
#   --build              Force rebuild of Docker images
#   --migrate            Run database migrations
#   --seed               Seed database with test data
#   --monitoring         Include Prometheus/Grafana stack
#   --clean              Clean up volumes before deployment
#   --logs               Follow logs after deployment
#   -h, --help           Show this help message
# =============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.staging.yml"
ENV_FILE="${PROJECT_DIR}/.env.staging"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Options
FORCE_BUILD=false
RUN_MIGRATIONS=false
SEED_DATABASE=false
INCLUDE_MONITORING=false
CLEAN_VOLUMES=false
FOLLOW_LOGS=false

log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $*"
}

error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

show_help() {
    head -16 "$0" | tail -12
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --build)
            FORCE_BUILD=true
            shift
            ;;
        --migrate)
            RUN_MIGRATIONS=true
            shift
            ;;
        --seed)
            SEED_DATABASE=true
            shift
            ;;
        --monitoring)
            INCLUDE_MONITORING=true
            shift
            ;;
        --clean)
            CLEAN_VOLUMES=true
            shift
            ;;
        --logs)
            FOLLOW_LOGS=true
            shift
            ;;
        -h|--help)
            show_help
            ;;
        *)
            error "Unknown option: $1"
            show_help
            ;;
    esac
done

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
        exit 1
    fi
    
    if ! docker compose version &> /dev/null; then
        error "Docker Compose is not available"
        exit 1
    fi
    
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        error "docker-compose.staging.yml not found"
        exit 1
    fi
    
    log "Prerequisites check passed"
}

# Create environment file if not exists
setup_environment() {
    log "Setting up environment..."
    
    if [[ ! -f "$ENV_FILE" ]]; then
        warn "Creating default .env.staging file..."
        cat > "$ENV_FILE" << 'EOF'
# DevOps AI Dashboard - Staging Environment Variables

# Database
POSTGRES_USER=devops
POSTGRES_PASSWORD=staging_secure_password_change_me
POSTGRES_DB=devops_staging
DATABASE_URL=postgresql://devops:staging_secure_password_change_me@db:5432/devops_staging

# Security
JWT_SECRET=staging_jwt_secret_change_me_in_production

# Redis
REDIS_URL=redis://redis:6379

# Application
NODE_ENV=staging
LOG_LEVEL=debug
STAGING_MODE=true

# Monitoring (optional)
GRAFANA_USER=admin
GRAFANA_PASSWORD=staging_grafana_password

# Version
VERSION=staging
EOF
        log "Created .env.staging - Please update with secure values!"
    fi
}

# Clean up volumes
clean_volumes() {
    if [[ "$CLEAN_VOLUMES" == true ]]; then
        warn "Cleaning up staging volumes..."
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down -v
        log "Volumes cleaned"
    fi
}

# Build images
build_images() {
    if [[ "$FORCE_BUILD" == true ]]; then
        log "Building Docker images..."
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache
    else
        log "Pulling/building Docker images..."
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build
    fi
}

# Start services
start_services() {
    log "Starting staging services..."
    
    PROFILES=""
    if [[ "$INCLUDE_MONITORING" == true ]]; then
        PROFILES="--profile monitoring"
    fi
    
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" $PROFILES up -d
    
    log "Waiting for services to be healthy..."
    sleep 10
}

# Run migrations
run_migrations() {
    if [[ "$RUN_MIGRATIONS" == true ]]; then
        log "Running database migrations..."
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T app pnpm db:push
        log "Migrations completed"
    fi
}

# Seed database
seed_database() {
    if [[ "$SEED_DATABASE" == true ]]; then
        log "Seeding database with test data..."
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T app node scripts/seed-staging.js || true
        log "Database seeding completed"
    fi
}

# Health check
health_check() {
    log "Running health check..."
    
    for i in {1..10}; do
        if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
            log "Health check passed!"
            return 0
        fi
        warn "Health check attempt $i/10 failed, retrying..."
        sleep 5
    done
    
    error "Health check failed after 10 attempts"
    return 1
}

# Show status
show_status() {
    echo ""
    echo "=========================================="
    echo "Staging Deployment Complete!"
    echo "=========================================="
    echo ""
    echo "Services:"
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
    echo ""
    echo "URLs:"
    echo "  - Application: http://localhost:3000"
    if [[ "$INCLUDE_MONITORING" == true ]]; then
        echo "  - Prometheus:  http://localhost:9090"
        echo "  - Grafana:     http://localhost:3001"
    fi
    echo ""
    echo "Logs:"
    echo "  docker compose -f docker-compose.staging.yml logs -f"
    echo ""
}

# Follow logs
follow_logs() {
    if [[ "$FOLLOW_LOGS" == true ]]; then
        log "Following logs (Ctrl+C to exit)..."
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs -f
    fi
}

# Main
main() {
    log "=========================================="
    log "DevOps AI Dashboard - Staging Deployment"
    log "=========================================="
    
    check_prerequisites
    setup_environment
    clean_volumes
    build_images
    start_services
    run_migrations
    seed_database
    
    if health_check; then
        show_status
        follow_logs
    else
        error "Deployment failed!"
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs --tail=50
        exit 1
    fi
}

main
