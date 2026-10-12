# ---- Stage 1: build the Angular app ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

# ---- Stage 2: serve it with a small Node server (no nginx) ----
FROM node:22-alpine
ENV NODE_ENV=production PORT=8080 API_URL=http://backend:5000
WORKDIR /app
COPY server/server.js ./server.js
COPY --from=build /app/dist/frontend/browser ./browser
USER node

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1

CMD ["node", "server.js"]
