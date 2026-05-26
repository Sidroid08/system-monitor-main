# Multi-stage build for Next.js application
FROM node:18-alpine AS builder

WORKDIR /app

# Accept build-time args for NEXT_PUBLIC vars (baked into the Next.js bundle)
ARG NEXT_PUBLIC_API_URL=http://localhost:8766/api
ARG NEXT_PUBLIC_VICTORIA_METRICS_URL=http://localhost:8767
ARG NEXT_PUBLIC_GRAFANA_URL=http://localhost:8769
ARG NEXT_PUBLIC_APP_URL=http://localhost:8765
ARG INTERNAL_API_URL=http://cloud-ventur-backend:5000/api

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_VICTORIA_METRICS_URL=$NEXT_PUBLIC_VICTORIA_METRICS_URL
ENV NEXT_PUBLIC_GRAFANA_URL=$NEXT_PUBLIC_GRAFANA_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV INTERNAL_API_URL=$INTERNAL_API_URL

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build Next.js application (NEXT_PUBLIC vars are baked in here)
RUN npm run build

# Production image
FROM node:18-alpine

WORKDIR /app

# Copy built standalone application from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Runtime environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Start application
CMD ["node", "server.js"]
