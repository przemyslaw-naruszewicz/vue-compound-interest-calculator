# Vue Compound Interest Calculator

A Vue 3 + Vite project for a compound interest calculator. Currently shows a welcome screen.

## Requirements

- Docker with Docker Compose, or Node.js 24.12+ (24.x) with npm.

## Run with Docker

```sh
docker compose up
```

Open [http://localhost:5173](http://localhost:5173). Dependencies install automatically;
the first run needs internet access. Source changes reload automatically.

Stop with `docker compose down`. For a different port, use `VUE_PORT=5174 docker compose up`.

## Run locally

```sh
npm ci
npm run dev
```

Open the URL printed by Vite.

## Build

With Docker running:

```sh
docker compose exec vue npm run build
```

Or locally:

```sh
npm run build
npm run preview
```

Output: `dist/`. The preview server is for local checks; production hosting needs separate setup.
