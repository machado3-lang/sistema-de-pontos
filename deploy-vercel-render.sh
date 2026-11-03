#!/bin/bash
set -e

echo "========================================="
echo "  Deploy PontoWeb (Vercel) + PontoCloud (Render)"
echo "========================================="

# === PONTOWEB no VERCEL ===
echo ""
echo "1/2 - Deployando PontoWeb no Vercel..."
echo ""

cd ponto-web

# Verifica se Vercel CLI existe
if ! command -v vercel &> /dev/null; then
  echo "Instalando Vercel CLI..."
  npm install -g vercel
fi

# Build de produção
npm ci
npm run build

# Deploy
echo ""
echo "Enviando para Vercel..."
vercel --prod --yes

cd ..

# === PONTOCLOUD no RENDER ===
echo ""
echo "2/2 - Deployando PontoCloud no Render..."
echo ""
echo "Para deploy manual no Render:"
echo "  1. Crie um Web Service em https://dashboard.render.com"
echo "  2. Conecte seu repositório GitHub"
echo "  3. Configure:"
echo "     - Root Directory: ponto-cloud"
echo "     - Build Command: npm install"
echo "     - Start Command: npm start"
echo "     - Health Check Path: /api/health"
echo "  4. Adicione variáveis de ambiente:"
echo "     - PORT=3100"
echo "     - API_TOKEN=seu-token-seguro"
echo ""
echo "Ou use Render CLI:"
echo "  render deploy --service <service-id>"

echo ""
echo "========================================="
echo "  Deploy concluído!"
echo "========================================="
echo ""
echo "  PontoCloud: https://seu-app.onrender.com"
echo "  PontoWeb:   https://seu-app.vercel.app"
echo ""
echo "  Configure a URL do PontoCloud nos Equipamentos > iDCloud"
echo "========================================="
