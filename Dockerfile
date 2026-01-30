# ===========================================
# AI Floor Plan Generator Backend - Dockerfile
# Optimized for Railway deployment
# ===========================================

# Use Node.js LTS Alpine for smaller image size
FROM node:20-alpine AS base

# Install dependencies needed for bcrypt native build
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# ===========================================
# Dependencies Stage
# ===========================================
FROM base AS deps

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --only=production --ignore-scripts && \
    npm rebuild bcrypt --build-from-source

# ===========================================
# Production Stage
# ===========================================
FROM node:20-alpine AS runner

# Set production environment
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodeuser

WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source code
COPY --chown=nodeuser:nodejs src ./src
COPY --chown=nodeuser:nodejs package.json ./

# Switch to non-root user
USER nodeuser

# Expose port (Railway will set PORT env var)
EXPOSE 5000

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 5000) + '/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the application
CMD ["node", "src/index.js"]
