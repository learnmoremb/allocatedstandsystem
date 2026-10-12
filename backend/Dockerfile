# ---- Backend API (Node.js / Express) ----
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# install production dependencies first so this layer is cached
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY samples ./samples

# receipts are stored on a volume mounted here
RUN mkdir -p uploads/receipts && chown -R node:node /app
USER node

EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/api/health || exit 1

CMD ["node", "src/server.js"]
