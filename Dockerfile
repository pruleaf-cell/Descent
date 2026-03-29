FROM node:22-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH

WORKDIR /app

RUN corepack enable && \
    apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

COPY . .

RUN pnpm install --frozen-lockfile && pnpm build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_FILE=/data/descent.db
ENV COOKIE_SECURE=true
ENV ADMIN_TOKEN=descent-admin

WORKDIR /app

COPY --from=build /app /app

EXPOSE 3000

VOLUME ["/data"]

CMD ["node", "./start-production.mjs"]
