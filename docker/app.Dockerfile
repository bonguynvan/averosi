# One image for apps/web and apps/worker (same monorepo layout as in development, so content/ and
# docs/ paths resolve exactly as they do under `next start`). The command picks the process.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
# NEXT_PUBLIC_* values are inlined at build time; defaults live in apps/web/src/lib/brand.ts.
ARG NEXT_PUBLIC_BRAND_NAME
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SOURCE_REPO_URL
ARG NEXT_PUBLIC_CONTACT_EMAIL
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @app/web build && pnpm prune --prod && rm -rf apps/web/.next/cache

FROM node:22-alpine
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
CMD ["node", "apps/web/node_modules/next/dist/bin/next", "start", "apps/web", "-p", "3000"]
