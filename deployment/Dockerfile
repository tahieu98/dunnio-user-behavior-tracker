FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/src ./src
COPY backend/scripts ./scripts
COPY backend/migrations ./migrations
COPY frontend /app/frontend
COPY tracker /app/tracker
RUN mkdir -p /var/lib/dunnio/snapshots /var/lib/dunnio/touch-archives && chown -R node:node /var/lib/dunnio
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DESKTOP_DATA_ROOT=/var/lib/dunnio TOUCH_ARCHIVE_DIR=/var/lib/dunnio/touch-archives PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium
EXPOSE 3000
CMD ["node", "src/index.js"]
