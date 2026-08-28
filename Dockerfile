FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/data/vuag.db \
    NUXT_DATABASE_PATH=/data/vuag.db
RUN groupadd --system --gid 1001 nuxt && useradd --system --uid 1001 --gid nuxt nuxt \
    && mkdir -p /data && chown -R nuxt:nuxt /data /app
COPY --from=builder --chown=nuxt:nuxt /app/.output ./.output
COPY --from=builder --chown=nuxt:nuxt /app/server/database/migrations ./server/database/migrations
USER nuxt
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
