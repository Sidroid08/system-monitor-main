# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV PORT=5000

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund --progress=false

COPY prisma ./prisma
RUN DATABASE_URL=mysql://placeholder:placeholder@localhost:3306/placeholder ./node_modules/.bin/prisma generate

COPY src ./src
COPY scripts ./scripts

EXPOSE 5000

USER node

CMD ["npm", "start"]
