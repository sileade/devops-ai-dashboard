#!/bin/bash
# DevOps AI Dashboard - Automated Installation Script
# Usage: curl -fsSL https://raw.githubusercontent.com/sileade/devops-ai-dashboard/main/scripts/install.sh | bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Banner
echo -e "${BLUE}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     ____              ___                  _    ___           ║
║    |  _ \  _____   __/ _ \ _ __  ___      / \  |_ _|          ║
║    | | | |/ _ \ \ / / | | | '_ \/ __|    / _ \  | |           ║
║    | |_| |  __/\ V /| |_| | |_) \__ \   / ___ \ | |           ║
║    |____/ \___| \_/  \___/| .__/|___/  /_/   \_\___|          ║
║                           |_|                                 ║
║                                                               ║
║              DevOps AI Dashboard Installer                    ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Configuration
INSTALL_DIR="${INSTALL_DIR:-/opt/devops-dashboard}"
GITHUB_REPO="sileade/devops-ai-dashboard"
BRANCH="${BRANCH:-main}"
DOMAIN="${DOMAIN:-localhost}"
ENABLE_MONITORING="${ENABLE_MONITORING:-false}"
ENABLE_TRAEFIK="${ENABLE_TRAEFIK:-false}"

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        exit 1
    fi
}

# Check system requirements
check_requirements() {
    log_info "Checking system requirements..."
    
    # Check OS
    if [[ ! -f /etc/os-release ]]; then
        log_error "Cannot determine OS. This script supports Ubuntu/Debian."
        exit 1
    fi
    
    source /etc/os-release
    if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
        log_warning "This script is tested on Ubuntu/Debian. Your OS: $ID"
    fi
    
    # Check memory
    TOTAL_MEM=$(free -m | awk '/^Mem:/{print $2}')
    if [[ $TOTAL_MEM -lt 2048 ]]; then
        log_warning "Recommended minimum RAM is 2GB. You have ${TOTAL_MEM}MB"
    fi
    
    # Check disk space
    FREE_DISK=$(df -m / | awk 'NR==2 {print $4}')
    if [[ $FREE_DISK -lt 5120 ]]; then
        log_warning "Recommended minimum free disk space is 5GB. You have ${FREE_DISK}MB"
    fi
    
    log_success "System requirements check completed"
}

# Install Docker
install_docker() {
    if command -v docker &> /dev/null; then
        log_info "Docker is already installed"
        return
    fi
    
    log_info "Installing Docker..."
    
    # Remove old versions
    apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # Install dependencies
    apt-get update
    apt-get install -y \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Add Docker's official GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Set up repository
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    
    log_success "Docker installed successfully"
}

# Install Docker Compose
install_docker_compose() {
    if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
        log_info "Docker Compose is already installed"
        return
    fi
    
    log_info "Installing Docker Compose..."
    
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep -oP '"tag_name": "\K(.*)(?=")')
    curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    
    log_success "Docker Compose installed successfully"
}

# Clone repository
clone_repository() {
    log_info "Cloning repository..."
    
    if [[ -d "$INSTALL_DIR" ]]; then
        log_warning "Installation directory exists. Backing up..."
        mv "$INSTALL_DIR" "${INSTALL_DIR}.backup.$(date +%Y%m%d%H%M%S)"
    fi
    
    git clone --depth 1 --branch "$BRANCH" "https://github.com/${GITHUB_REPO}.git" "$INSTALL_DIR"
    
    log_success "Repository cloned to $INSTALL_DIR"
}

# Generate secrets
generate_secrets() {
    log_info "Generating secrets..."
    
    JWT_SECRET=$(openssl rand -hex 32)
    DB_PASSWORD=$(openssl rand -hex 16)
    REDIS_PASSWORD=$(openssl rand -hex 16)
    WEBHOOK_SECRET=$(openssl rand -hex 20)
    GRAFANA_PASSWORD=$(openssl rand -hex 12)
    
    log_success "Secrets generated"
}

# Create environment file
create_env_file() {
    log_info "Creating environment file..."
    
    cat > "$INSTALL_DIR/.env" << EOF
# DevOps AI Dashboard - Environment Configuration
# Generated on $(date)

# Application
APP_PORT=3000
NODE_ENV=production
DOMAIN=${DOMAIN}

# Security
JWT_SECRET=${JWT_SECRET}

# Database
DATABASE_URL=postgresql://devops:${DB_PASSWORD}@db:5432/devops_dashboard
DB_USER=devops
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=devops_dashboard

# Redis
REDIS_PASSWORD=${REDIS_PASSWORD}

# GitOps Pull Agent
GITHUB_REPO=${GITHUB_REPO}
GITHUB_BRANCH=${BRANCH}
GITHUB_WEBHOOK_SECRET=${WEBHOOK_SECRET}
POLL_INTERVAL=300
WEBHOOK_PORT=9000

# Monitoring (optional)
PROMETHEUS_URL=http://prometheus:9090
GRAFANA_URL=http://grafana:3000
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=${GRAFANA_PASSWORD}

# SSL (for Traefik)
ACME_EMAIL=admin@${DOMAIN}
HTTP_PORT=80
HTTPS_PORT=443

# OAuth (configure these manually)
VITE_APP_ID=
OAUTH_SERVER_URL=
VITE_OAUTH_PORTAL_URL=
OWNER_OPEN_ID=
OWNER_NAME=

# Forge API (configure these manually)
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
VITE_FRONTEND_FORGE_API_KEY=
VITE_FRONTEND_FORGE_API_URL=

# SMTP (configure these manually)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

# Notifications (optional)
SLACK_WEBHOOK=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
EOF

    chmod 600 "$INSTALL_DIR/.env"
    
    log_success "Environment file created at $INSTALL_DIR/.env"
}

# Create systemd service
create_systemd_service() {
    log_info "Creating systemd service..."
    
    cat > /etc/systemd/system/devops-dashboard.service << EOF
[Unit]
Description=DevOps AI Dashboard
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
ExecReload=/usr/bin/docker compose restart

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable devops-dashboard
    
    log_success "Systemd service created"
}

# Start services
start_services() {
    log_info "Starting services..."
    
    cd "$INSTALL_DIR"
    
    # Build and start
    COMPOSE_PROFILES=""
    
    if [[ "$ENABLE_MONITORING" == "true" ]]; then
        COMPOSE_PROFILES="$COMPOSE_PROFILES --profile monitoring"
    fi
    
    if [[ "$ENABLE_TRAEFIK" == "true" ]]; then
        COMPOSE_PROFILES="$COMPOSE_PROFILES --profile traefik"
    else
        COMPOSE_PROFILES="$COMPOSE_PROFILES --profile nginx"
    fi
    
    docker compose $COMPOSE_PROFILES up -d --build
    
    log_success "Services started"
}

# Wait for services to be healthy
wait_for_services() {
    log_info "Waiting for services to be healthy..."
    
    local max_attempts=60
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
    
    log_error "Services did not become healthy in time"
    return 1
}

# Print installation summary
print_summary() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║           Installation Completed Successfully!                ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Installation Directory:${NC} $INSTALL_DIR"
    echo -e "${BLUE}Application URL:${NC} http://${DOMAIN}:3000"
    echo ""
    echo -e "${YELLOW}Important:${NC}"
    echo "1. Configure OAuth settings in $INSTALL_DIR/.env"
    echo "2. Configure SMTP settings for email notifications"
    echo "3. Set up GitHub webhook at: https://github.com/${GITHUB_REPO}/settings/hooks"
    echo "   - Payload URL: http://${DOMAIN}:9000/webhook/github"
    echo "   - Secret: ${WEBHOOK_SECRET}"
    echo ""
    if [[ "$ENABLE_MONITORING" == "true" ]]; then
        echo -e "${BLUE}Monitoring:${NC}"
        echo "  - Prometheus: http://${DOMAIN}:9090"
        echo "  - Grafana: http://${DOMAIN}:3001 (admin/${GRAFANA_PASSWORD})"
        echo ""
    fi
    echo -e "${BLUE}Useful Commands:${NC}"
    echo "  - View logs: docker compose logs -f"
    echo "  - Restart: systemctl restart devops-dashboard"
    echo "  - Update: $INSTALL_DIR/scripts/update.sh"
    echo ""
    echo -e "${GREEN}Thank you for installing DevOps AI Dashboard!${NC}"
}

# Main installation flow
main() {
    log_info "Starting DevOps AI Dashboard installation..."
    
    check_root
    check_requirements
    install_docker
    install_docker_compose
    clone_repository
    generate_secrets
    create_env_file
    create_systemd_service
    start_services
    wait_for_services
    print_summary
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        --branch)
            BRANCH="$2"
            shift 2
            ;;
        --install-dir)
            INSTALL_DIR="$2"
            shift 2
            ;;
        --with-monitoring)
            ENABLE_MONITORING="true"
            shift
            ;;
        --with-traefik)
            ENABLE_TRAEFIK="true"
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --domain <domain>      Domain name (default: localhost)"
            echo "  --branch <branch>      Git branch (default: main)"
            echo "  --install-dir <path>   Installation directory (default: /opt/devops-dashboard)"
            echo "  --with-monitoring      Enable Prometheus/Grafana"
            echo "  --with-traefik         Use Traefik instead of Nginx"
            echo "  --help                 Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main installation
main
