#!/bin/bash

# OpenClaw Integration Setup Script
# This script helps configure OpenClaw Gateway with DevOps AI Dashboard

set -e

echo "🦞 OpenClaw Integration Setup for DevOps AI Dashboard"
echo "======================================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# DevOps AI Dashboard Configuration
NODE_ENV=production

# Database (optional)
# DATABASE_URL=mysql://root:devops123@database:3306/devops_dashboard

# AI Model API Keys
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# OpenClaw Gateway Configuration
OPENCLAW_GATEWAY_TOKEN=
OPENCLAW_GATEWAY_URL=http://openclaw-gateway:18789

# MySQL (if using database profile)
MYSQL_ROOT_PASSWORD=devops123
EOF
    echo "✅ .env file created. Please edit it with your API keys."
fi

# Generate OpenClaw Gateway token if not set
if [ -z "$OPENCLAW_GATEWAY_TOKEN" ]; then
    echo "🔑 Generating OpenClaw Gateway token..."
    OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)
    
    # Update .env file
    if grep -q "OPENCLAW_GATEWAY_TOKEN=" .env; then
        sed -i "s/OPENCLAW_GATEWAY_TOKEN=.*/OPENCLAW_GATEWAY_TOKEN=$OPENCLAW_GATEWAY_TOKEN/" .env
    else
        echo "OPENCLAW_GATEWAY_TOKEN=$OPENCLAW_GATEWAY_TOKEN" >> .env
    fi
    
    echo "✅ Gateway token generated and saved to .env"
fi

echo ""
echo "🚀 Starting services..."
echo ""

# Start the services
docker compose -f docker-compose.openclaw.yml up -d

echo ""
echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
echo ""
echo "🔍 Checking service status..."
echo ""

# Check DevOps Dashboard
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ DevOps AI Dashboard is running at http://localhost:3000"
else
    echo "⚠️  DevOps AI Dashboard is starting... (may take a moment)"
fi

# Check OpenClaw Gateway
if curl -s http://localhost:18789/health > /dev/null 2>&1; then
    echo "✅ OpenClaw Gateway is running at http://localhost:18789"
else
    echo "⚠️  OpenClaw Gateway is starting... (may take a moment)"
fi

echo ""
echo "======================================================"
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Open DevOps AI Dashboard: http://localhost:3000"
echo "2. Go to OpenClaw ChatOps page"
echo "3. Configure your messaging channels (Telegram, Slack, etc.)"
echo ""
echo "To configure channels via CLI:"
echo "  docker compose -f docker-compose.openclaw.yml run --rm openclaw-cli channels login"
echo ""
echo "To view logs:"
echo "  docker compose -f docker-compose.openclaw.yml logs -f"
echo ""
echo "To stop services:"
echo "  docker compose -f docker-compose.openclaw.yml down"
echo ""
