# One image for apps/web and apps/worker. Only runtime files ship:
#   /app/apps/web/server.js  — Next.js standalone server (traced node_modules only)
#   /app/content, /app/docs  — Markdown read at runtime (paths are resolved from the build-time /app root)
#   /worker                  — `pnpm deploy --prod` of apps/worker (tsx runs the TypeScript sources)
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
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
RUN pnpm --filter @app/web build
RUN pnpm --filter @app/worker deploy --prod --legacy /worker

FROM node:22-alpine
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/content ./content
COPY --from=build --chown=node:node /app/docs ./docs
COPY --from=build --chown=node:node /worker /worker
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
