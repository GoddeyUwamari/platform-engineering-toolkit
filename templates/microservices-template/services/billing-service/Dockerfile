# ==========================================
# Stage 1: Builder - Build the application
# ==========================================
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy root-level files needed for build
COPY package.json ./
COPY package-lock.json ./
COPY tsconfig.json ./

# Copy entire shared folder (source)
COPY shared ./shared

# Copy billing-service
COPY services/billing-service ./services/billing-service

# Install ALL dependencies at root (includes @types/node, typescript, etc.)
RUN npm ci

# Build shared library first
RUN cd shared && npm run build

# Build billing-service using Docker-specific tsconfig
RUN cd services/billing-service && \
    npx tsc --project tsconfig.docker.json

# ==========================================
# Stage 2: Production - Create lean image
# ==========================================
FROM node:18-alpine AS production

# Install dumb-init (proper signal handling)
RUN apk add --no-cache dumb-init

# Create app user (security: don't run as root)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy shared dist folder
COPY --from=builder --chown=nodejs:nodejs /app/shared/dist ./shared/dist

# Copy the entire compiled dist folder structure
COPY --from=builder --chown=nodejs:nodejs /app/services/billing-service/dist ./dist

# Copy package files from billing-service and root lock file
COPY --from=builder --chown=nodejs:nodejs /app/services/billing-service/package.json ./
COPY --from=builder --chown=nodejs:nodejs /app/package-lock.json ./package-lock.json

# Install only production dependencies
RUN npm ci --omit=dev

# Copy shared dist to node_modules/@shared
RUN mkdir -p node_modules/@shared && \
    cp -r shared/dist/* node_modules/@shared/

# Create logs directory with proper permissions
RUN mkdir -p logs && chown -R nodejs:nodejs logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3002/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/services/billing-service/src/index.js"]
