FROM node:20-alpine

WORKDIR /app

# Copiar código de backend, frontend y plantillas/base de datos
COPY backend ./backend
COPY frontend ./frontend
COPY package.json ./package.json

# Variables de entorno por defecto para Cloud Run
ENV NODE_ENV=production
ENV PORT=8080
ENV GCP_PROJECT_ID=agente-deviajecon
ENV GCP_REGION=us-central1
ENV PRIMARY_VISION_MODEL=gemini-3.8-flash
ENV SECONDARY_VISION_MODEL=gemini-3.1-pro

EXPOSE 8080

CMD ["node", "backend/src/standalone-server.js"]
