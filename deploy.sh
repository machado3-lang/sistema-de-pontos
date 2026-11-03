#!/bin/bash
set -e

echo "=============================="
echo "  Ponto - Deploy Automatizado"
echo "=============================="

CONFIG_FILE=".env.prod"
if [ ! -f "$CONFIG_FILE" ]; then
  echo "Criando $CONFIG_FILE... (preencha com suas credenciais)"
  cat > "$CONFIG_FILE" << EOF
# PostgreSQL (Railway ou local)
DATABASE_URL=postgresql://usuario:senha@host:5432/pontoweb
PGSSL=false

# PontoCloud / Auth
API_TOKEN=gere-um-token-forte
ADMIN_USER=admin
ADMIN_PASSWORD=gere-uma-senha-forte
MOBILE_TOKEN_SECRET=gere-outro-segredo
CORS_ORIGINS=http://localhost
EOF
  echo "Arquivo $CONFIG_FILE criado. Edite com suas credenciais e execute novamente."
  exit 1
fi

source "$CONFIG_FILE"

export DATABASE_URL
export PGSSL
export API_TOKEN
export ADMIN_USER
export ADMIN_PASSWORD
export MOBILE_TOKEN_SECRET
export CORS_ORIGINS

echo ""
echo "1/4 - Buildando ponto-web..."
cd ponto-web
npm ci
npm run build
cd ..

echo ""
echo "2/4 - Buildando containers Docker..."
docker compose build

echo ""
echo "3/4 - Parando containers antigos..."
docker compose down --remove-orphans 2>/dev/null || true

echo ""
echo "4/4 - Subindo containers..."
docker compose up -d

echo ""
echo "=============================="
echo "  Deploy concluído!"
echo "=============================="
echo ""
echo "  PontoCloud: http://localhost:3100/api/health"
echo "  PontoWeb:   http://localhost:80"
echo ""
echo "  Logs: docker compose logs -f"
echo "  Parar: docker compose down"
echo "=============================="
