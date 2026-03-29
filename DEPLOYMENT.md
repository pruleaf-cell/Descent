# Deployment

This workspace is packaged to run as a single container:

- public Fastify server on `PORT`
- SQLite persisted at `DB_FILE`
- `start:prod` boots the API in production mode and serves `apps/web/dist` with SPA fallback from the same process

## Local production smoke test

```bash
./pnpmw build
PORT=3000 DB_FILE=./apps/api/data/descent.db ./pnpmw start:prod
```

Open `http://127.0.0.1:3000` and check `http://127.0.0.1:3000/healthz`.

## Docker

```bash
docker build -t descent-web .
docker run --rm -p 3000:3000 -e PORT=3000 -e DB_FILE=/data/descent.db -e COOKIE_SECURE=false -v descent-data:/data descent-web
```

## Required environment

- `PORT`: public HTTP port for the combined app
- `DB_FILE`: absolute path to the SQLite file; use a persistent disk path on hosted platforms
- `COOKIE_SECURE`: `true` in HTTPS production, `false` for local smoke tests
- `ADMIN_TOKEN`: admin-only API token

## Platform notes

- Render: use the repository `Dockerfile`, attach a persistent disk mounted at `/data`, and set `DB_FILE=/data/descent.db`.
- Fly.io: deploy the `Dockerfile`, attach a volume mounted at `/data`, and set `DB_FILE=/data/descent.db`.
- Vercel is not a good fit for this backend because the app expects a long-running Node process plus persistent SQLite storage.
