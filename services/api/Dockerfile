FROM node:20-alpine AS base
WORKDIR /app
COPY package.json ./

# ─── Development ────────────────────────────────────────────────────────────
FROM base AS development
RUN npm install
COPY . .
EXPOSE 4000
CMD ["npx", "nest", "start", "--watch"]

# ─── Build ──────────────────────────────────────────────────────────────────
FROM base AS build
RUN npm install
COPY . .
RUN npm run build

# ─── Production ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY package.json ./
RUN npm install --omit=dev --legacy-peer-deps
EXPOSE 4000
# PO-047 (NEM-024 Q-11): single-threaded V8 GC for the API process only. Under the 1-vCPU quota, parallel GC helper
# threads compete with the event loop (PO-046 report). Set here, not in NODE_OPTIONS, so `npm run migration:run:prod`
# and any other node process in this container keep the default runtime.
CMD ["node", "--single-threaded-gc", "dist/main"]
