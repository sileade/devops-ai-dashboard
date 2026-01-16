# GitOps-lite Pull Agent
# Lightweight service for automatic deployment from GitHub

FROM node:22-alpine

WORKDIR /app

# Install required tools
RUN apk add --no-cache \
    git \
    curl \
    docker-cli \
    openssh-client \
    bash

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json ./

# Install dependencies
RUN pnpm install --prod

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S agent && \
    adduser -S agent -u 1001 -G agent

# Create data directory
RUN mkdir -p /app/data && chown -R agent:agent /app/data

# Note: Running as root to access docker socket
# In production, add user to docker group instead

# Environment variables
ENV NODE_ENV=production
ENV WEBHOOK_PORT=9000

# Expose webhook port
EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:9000/health || exit 1

# Start the agent
CMD ["node", "index.js"]
