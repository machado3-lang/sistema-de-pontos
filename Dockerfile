# ── Build do frontend ───────────────────────────────────────────────────────
FROM node:20-alpine AS web
WORKDIR /web
COPY ponto-web/package*.json ./
RUN npm ci
COPY ponto-web/ ./
RUN npm run build

# ── Backend + frontend estático ─────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY ponto-cloud/package*.json ./
RUN npm ci --omit=dev
COPY ponto-cloud/ ./
COPY --from=web /web/dist ./public

RUN mkdir -p /app/data
EXPOSE 3100
CMD ["node", "server.js"]
