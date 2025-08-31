# Build stage
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    pkgconfig \
    vips-dev \
    vips-tools \
    fftw-dev

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    vips-dev \
    vips-tools \
    fftw-dev \
    tesseract-ocr \
    tesseract-ocr-data-chi_sim

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S lawfirm -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder --chown=lawfirm:nodejs /app/dist ./dist
COPY --from=builder --chown=lawfirm:nodejs /app/prisma ./prisma
COPY --from=builder --chown=lawfirm:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Copy configuration files
COPY --chown=lawfirm:nodejs ./config ./config
COPY --chown=lawfirm:nodejs ./public ./public

# Create directories for uploads and logs
RUN mkdir -p /app/uploads /app/logs /app/temp && \
    chown -R lawfirm:nodejs /app/uploads /app/logs /app/temp

# Switch to non-root user
USER lawfirm

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]