# =============================================================================
# Multi-Stage Production Dockerfile
# =============================================================================
# Stage 1: Builder - Compile TypeScript and install dependencies
# Stage 2: Production - Minimal runtime image
#
# Best Practices:
# - Non-root user for security
# - Multi-stage build for minimal image size
# - Layer caching optimization
# - Health check integration
# - Proper signal handling with dumb-init
# =============================================================================

# =============================================================================
# Stage 1: Builder
# =============================================================================
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
# This layer is cached unless package files change
COPY package*.json ./
COPY tsconfig.json ./

# Install ALL dependencies (including devDependencies for building)
RUN npm ci --quiet && npm cache clean --force

# Copy source code
COPY src ./src

# Build TypeScript to JavaScript
RUN npm run build

# Prune dev dependencies - keep only production dependencies
RUN npm prune --production

# =============================================================================
# Stage 2: Production Runtime
# =============================================================================
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
# dumb-init ensures SIGTERM signals are properly forwarded to Node.js
RUN apk add --no-cache dumb-init && rm -rf /var/cache/apk/*

# Create non-root user and group
# Using UID/GID 1001 for consistency with common security practices
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy package files
COPY --chown=nodejs:nodejs package*.json ./

# Copy production dependencies from builder
COPY --chown=nodejs:nodejs --from=builder /app/node_modules ./node_modules

# Copy compiled JavaScript from builder
COPY --chown=nodejs:nodejs --from=builder /app/dist ./dist

# Copy any additional runtime files
COPY --chown=nodejs:nodejs .env.example ./.env.example

# Create necessary directories with correct permissions
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app/logs

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Expose application port
EXPOSE 3000

# Switch to non-root user
USER nodejs

# Health check
# Kubernetes will use this to determine if container is healthy
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init as entrypoint for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/server.js"]

# =============================================================================
# Build Instructions:
# =============================================================================
# Build image:
#   docker build -f infrastructure/docker/Dockerfile -t production-api:latest .
#
# Build with specific tag:
#   docker build -f infrastructure/docker/Dockerfile -t production-api:v1.0.0 .
#
# Build multi-architecture (for ARM and x86):
#   docker buildx build --platform linux/amd64,linux/arm64 \
#     -f infrastructure/docker/Dockerfile -t production-api:latest .
#
# Run container:
#   docker run -p 3000:3000 \
#     -e DB_HOST=postgres \
#     -e REDIS_HOST=redis \
#     production-api:latest
#
# Expected image size: ~150-200MB (significantly smaller than dev image)
# =============================================================================
