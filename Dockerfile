FROM node:22-alpine

WORKDIR /app

# Copiar código de backend, frontend, manual y base de datos
COPY backend ./backend
COPY frontend ./frontend
COPY package.json ./package.json

# Variables de entorno por defecto para Cloud Run (Versión voz-constructora-v5 + Gemini >= 3.8 Flash)
ENV NODE_ENV=production
ENV PORT=8080
ENV APP_VERSION=voz-constructora-v5
ENV GCP_PROJECT_ID=agente-deviajecon
ENV GCP_REGION=us-central1
ENV PRIMARY_VISION_MODEL=gemini-3.8-flash
ENV SECONDARY_VISION_MODEL=gemini-3.8-pro
ENV TTS_VOICE_MODEL=es-US-Neural2-B

EXPOSE 8080

CMD ["node", "backend/src/standalone-server.js"]
