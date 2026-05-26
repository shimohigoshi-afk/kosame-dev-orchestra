# KOSAME Cloud Run PM Agent — Dockerfile (v0.2.3)
# Build target: Cloud Run (Node.js HTTP server)
# DO NOT copy dotenv files or secrets. DO NOT run gcloud. DO NOT call external APIs.
# docker build is NOT executed in this version — v0.3.0 Human Approval required first.

FROM node:20-slim

WORKDIR /app

# Copy package manifests first for layer caching
COPY package*.json ./

# Install production dependencies (run by human after approval, not by CI in this version)
RUN npm ci --omit=dev

# Copy application source (excluding items in .dockerignore)
COPY . .

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["npm", "run", "pm-agent:http-dry-run"]
