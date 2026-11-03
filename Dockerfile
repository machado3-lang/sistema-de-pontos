FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Backend fica em ponto-cloud/, mas o contexto de build do Railway é a raiz.
COPY ponto-cloud/package*.json ./
RUN npm ci --omit=dev
COPY ponto-cloud/ ./

RUN mkdir -p /app/data
EXPOSE 3100
CMD ["node", "server.js"]
