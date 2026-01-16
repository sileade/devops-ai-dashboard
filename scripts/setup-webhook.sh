#!/bin/bash
# =============================================================================
# DevOps AI Dashboard - GitHub Webhook Setup Script
# =============================================================================
# This script sets up a webhook listener for automatic deployments
# triggered by GitHub push events.
#
# Usage: ./scripts/setup-webhook.sh [OPTIONS]
#
# Options:
#   --port PORT          Port to listen on (default: 9000)
#   --secret SECRET      Webhook secret (required)
#   --branch BRANCH      Branch to deploy (default: main)
#   --systemd            Install as systemd service
#   -h, --help           Show this help message
# =============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
WEBHOOK_PORT=9000
WEBHOOK_SECRET=""
DEPLOY_BRANCH="main"
INSTALL_SYSTEMD=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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
    head -18 "$0" | tail -14
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --port)
            WEBHOOK_PORT="$2"
            shift 2
            ;;
        --secret)
            WEBHOOK_SECRET="$2"
            shift 2
            ;;
        --branch)
            DEPLOY_BRANCH="$2"
            shift 2
            ;;
        --systemd)
            INSTALL_SYSTEMD=true
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

# Validate secret
if [[ -z "$WEBHOOK_SECRET" ]]; then
    error "Webhook secret is required. Use --secret to specify."
    exit 1
fi

# Create webhook handler script
log "Creating webhook handler..."

cat > "${PROJECT_DIR}/scripts/webhook-handler.sh" << 'HANDLER_EOF'
#!/bin/bash
# GitHub Webhook Handler for DevOps AI Dashboard

set -euo pipefail

PROJECT_DIR="__PROJECT_DIR__"
DEPLOY_BRANCH="__DEPLOY_BRANCH__"
WEBHOOK_SECRET="__WEBHOOK_SECRET__"
LOG_FILE="${PROJECT_DIR}/logs/webhook.log"

mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

verify_signature() {
    local payload="$1"
    local signature="$2"
    
    local expected_sig="sha256=$(echo -n "$payload" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | awk '{print $2}')"
    
    if [[ "$signature" == "$expected_sig" ]]; then
        return 0
    else
        return 1
    fi
}

handle_push() {
    local payload="$1"
    local ref=$(echo "$payload" | jq -r '.ref')
    local branch="${ref#refs/heads/}"
    
    log "Received push event for branch: $branch"
    
    if [[ "$branch" != "$DEPLOY_BRANCH" ]]; then
        log "Ignoring push to non-deploy branch: $branch"
        echo "Ignored: not deploy branch"
        return 0
    fi
    
    log "Starting deployment for branch: $branch"
    
    # Run deployment
    cd "$PROJECT_DIR"
    if ./scripts/deploy.sh --force --notify 2>&1 | tee -a "$LOG_FILE"; then
        log "Deployment completed successfully"
        echo "Deployment successful"
    else
        log "Deployment failed!"
        echo "Deployment failed"
        return 1
    fi
}

handle_release() {
    local payload="$1"
    local action=$(echo "$payload" | jq -r '.action')
    local tag=$(echo "$payload" | jq -r '.release.tag_name')
    
    log "Received release event: action=$action, tag=$tag"
    
    if [[ "$action" != "published" ]]; then
        log "Ignoring release action: $action"
        echo "Ignored: not published"
        return 0
    fi
    
    log "Starting deployment for release: $tag"
    
    # Run deployment with specific version
    cd "$PROJECT_DIR"
    if ./scripts/deploy.sh --version "${tag#v}" --force --notify 2>&1 | tee -a "$LOG_FILE"; then
        log "Release deployment completed successfully"
        echo "Release deployment successful"
    else
        log "Release deployment failed!"
        echo "Release deployment failed"
        return 1
    fi
}

# Main handler
main() {
    local event_type="${HTTP_X_GITHUB_EVENT:-push}"
    local signature="${HTTP_X_HUB_SIGNATURE_256:-}"
    
    # Read payload
    local payload
    payload=$(cat)
    
    log "Received webhook: event=$event_type"
    
    # Verify signature
    if [[ -n "$signature" ]]; then
        if ! verify_signature "$payload" "$signature"; then
            log "ERROR: Invalid signature"
            echo "Invalid signature"
            exit 1
        fi
        log "Signature verified"
    else
        log "WARNING: No signature provided"
    fi
    
    # Handle event
    case "$event_type" in
        push)
            handle_push "$payload"
            ;;
        release)
            handle_release "$payload"
            ;;
        ping)
            log "Ping received"
            echo "Pong!"
            ;;
        *)
            log "Ignoring event type: $event_type"
            echo "Event ignored"
            ;;
    esac
}

main
HANDLER_EOF

# Replace placeholders
sed -i "s|__PROJECT_DIR__|${PROJECT_DIR}|g" "${PROJECT_DIR}/scripts/webhook-handler.sh"
sed -i "s|__DEPLOY_BRANCH__|${DEPLOY_BRANCH}|g" "${PROJECT_DIR}/scripts/webhook-handler.sh"
sed -i "s|__WEBHOOK_SECRET__|${WEBHOOK_SECRET}|g" "${PROJECT_DIR}/scripts/webhook-handler.sh"

chmod +x "${PROJECT_DIR}/scripts/webhook-handler.sh"

# Create webhook server using socat/netcat
log "Creating webhook server..."

cat > "${PROJECT_DIR}/scripts/webhook-server.sh" << 'SERVER_EOF'
#!/bin/bash
# Simple webhook server using socat

PROJECT_DIR="__PROJECT_DIR__"
PORT="__PORT__"
HANDLER="${PROJECT_DIR}/scripts/webhook-handler.sh"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

log "Starting webhook server on port $PORT..."

while true; do
    # Use socat to handle HTTP requests
    socat -T 30 TCP-LISTEN:${PORT},reuseaddr,fork EXEC:"${HANDLER}" 2>&1 || {
        log "Server error, restarting in 5s..."
        sleep 5
    }
done
SERVER_EOF

sed -i "s|__PROJECT_DIR__|${PROJECT_DIR}|g" "${PROJECT_DIR}/scripts/webhook-server.sh"
sed -i "s|__PORT__|${WEBHOOK_PORT}|g" "${PROJECT_DIR}/scripts/webhook-server.sh"

chmod +x "${PROJECT_DIR}/scripts/webhook-server.sh"

# Install systemd service if requested
if [[ "$INSTALL_SYSTEMD" == true ]]; then
    log "Installing systemd service..."
    
    sudo tee /etc/systemd/system/devops-webhook.service > /dev/null << SERVICE_EOF
[Unit]
Description=DevOps AI Dashboard Webhook Server
After=network.target docker.service

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=${PROJECT_DIR}
ExecStart=${PROJECT_DIR}/scripts/webhook-server.sh
Restart=always
RestartSec=10
StandardOutput=append:${PROJECT_DIR}/logs/webhook-server.log
StandardError=append:${PROJECT_DIR}/logs/webhook-server.log

[Install]
WantedBy=multi-user.target
SERVICE_EOF

    sudo systemctl daemon-reload
    sudo systemctl enable devops-webhook
    sudo systemctl start devops-webhook
    
    log "Systemd service installed and started"
fi

# Print setup instructions
echo ""
echo "=========================================="
echo "GitHub Webhook Setup Complete!"
echo "=========================================="
echo ""
echo "Webhook URL: http://YOUR_SERVER_IP:${WEBHOOK_PORT}"
echo "Secret: ${WEBHOOK_SECRET}"
echo "Branch: ${DEPLOY_BRANCH}"
echo ""
echo "To configure GitHub webhook:"
echo "1. Go to your repository Settings → Webhooks"
echo "2. Click 'Add webhook'"
echo "3. Set Payload URL to: http://YOUR_SERVER_IP:${WEBHOOK_PORT}"
echo "4. Set Content type to: application/json"
echo "5. Set Secret to: ${WEBHOOK_SECRET}"
echo "6. Select events: 'Just the push event' or 'Releases'"
echo "7. Click 'Add webhook'"
echo ""

if [[ "$INSTALL_SYSTEMD" == true ]]; then
    echo "Webhook server is running as a systemd service."
    echo "Commands:"
    echo "  sudo systemctl status devops-webhook"
    echo "  sudo systemctl restart devops-webhook"
    echo "  sudo journalctl -u devops-webhook -f"
else
    echo "To start the webhook server manually:"
    echo "  ${PROJECT_DIR}/scripts/webhook-server.sh"
    echo ""
    echo "Or install as systemd service:"
    echo "  ./scripts/setup-webhook.sh --secret '${WEBHOOK_SECRET}' --systemd"
fi
echo ""
