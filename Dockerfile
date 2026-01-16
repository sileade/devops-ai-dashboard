# DevOps AI Dashboard - Production Dockerfile
# Multi-stage build for optimized image size
# Build: docker build -t devops-ai-dashboard .
# Run: docker run -p 3000:3000 devops-ai-dashboard

ARG NODE_VERSION=22
ARG ALPINE_VERSION=3.19

# =============================================================================
# Stage 1: Dependencies
# =============================================================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS deps

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files for dependency caching
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including dev for build)
RUN pnpm install --frozen-lockfile

# =============================================================================
# Stage 2: Builder
# =============================================================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml ./

# Copy source code
COPY . .

# Build arguments for versioning
ARG VERSION=1.0.0
ARG BUILD_DATE
ARG GIT_COMMIT

# Set build-time environment variables
ENV VERSION=${VERSION}
ENV BUILD_DATE=${BUILD_DATE}
ENV GIT_COMMIT=${GIT_COMMIT}

# Build the application
RUN pnpm build

# Prune dev dependencies after build
RUN pnpm prune --prod

# =============================================================================
# Stage 3: Production
# =============================================================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS production

# Install security updates and required packages
RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
      dumb-init \
      curl \
      wget \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S devops -u 1001 -G nodejs

# Copy production dependencies
COPY --from=builder --chown=devops:nodejs /app/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=devops:nodejs /app/dist ./dist
COPY --from=builder --chown=devops:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=devops:nodejs /app/server ./server
COPY --from=builder --chown=devops:nodejs /app/shared ./shared
COPY --from=builder --chown=devops:nodejs /app/package.json ./package.json

# Build arguments for labels
ARG VERSION=1.0.0
ARG BUILD_DATE
ARG GIT_COMMIT

# OCI Image Labels
LABEL org.opencontainers.image.title="DevOps AI Dashboard" \
      org.opencontainers.image.description="AI-powered DevOps automation platform" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.vendor="DevOps AI Team" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.source="https://github.com/sileade/devops-ai-dashboard"

# Switch to non-root user
USER devops

# Environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    VERSION=${VERSION}

# Expose port
EXPOSE 3000

# Health check with improved settings
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/server/index.js"]
