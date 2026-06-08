# KOSAME Cloud Run Dashboard — Dockerfile (v110.25)
# Build target: Cloud Run (kosame-dashboard, port 8080)
# DO NOT copy dotenv files or secrets. DO NOT run gcloud. DO NOT call external APIs.
# docker build is NOT executed automatically — Human Approval required before deploy.

FROM node:24-slim

WORKDIR /app

# Copy package manifests first for layer caching
COPY package*.json ./

# Install production dependencies (run by human after approval, not by CI in this version)
RUN npm install --omit=dev

# Copy application source (excluding items in .dockerignore)
COPY . .

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["npm", "run", "dashboard"]
