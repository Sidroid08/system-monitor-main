# Multi-stage build for Backend Express application
# Use node:18 (Debian-based, not Alpine) to avoid libssl.so.1.1 compatibility issues with Prisma
FROM node:18-slim

WORKDIR /app

# Install OpenSSL and other required system libraries for Prisma
RUN apt-get update -y && apt-get install -y openssl libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source code
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

# Start: push schema to MySQL then start the server
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && npm start"]
