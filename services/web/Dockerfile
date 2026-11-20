FROM node:20-alpine AS base
WORKDIR /app
COPY package.json ./

# ─── Development ────────────────────────────────────────────────────────────
FROM base AS development
RUN npm install
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ─── Build ──────────────────────────────────────────────────────────────────
FROM base AS build
RUN npm install
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# S-ALT: the /api rewrite target is baked at build time. Default = the project-unique
# alias declared in docker-compose.server.yml (never the generic `api`, which other
# projects also answer on the shared proxy network). Override with --build-arg.
ARG INTERNAL_API_URL=http://noetia-api.internal:4000
ENV INTERNAL_API_URL=$INTERNAL_API_URL
ENV NEXT_PUBLIC_API_URL=https://noetia.app/api
ENV NEXT_PUBLIC_OAUTH_URL=https://noetia.app/api
RUN npm run build

# ─── Production ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
