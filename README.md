# Vue Compound Interest Calculator

A Vue 3 + Vite compound interest calculator demo. Adjust the initial investment,
monthly contribution, duration, and annual nominal return to see a live projection.
The interface is in English; amounts default to Polish złoty (`pl-PL` / `PLN`).

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

## Quality checks

```sh
npm run lint
npm test
npm run build
```

For test development, use `npm run test:watch`. `npm test` runs once and exits
with a nonzero status on failure. With Docker running, prefix these commands
with `docker compose exec vue`, for example `docker compose exec vue npm test`.

Vitest shares the Vite configuration, including Vue SFC support. Tests default
to the Node environment so domain tests do not require a DOM. Add
`// @vitest-environment jsdom` at the top of component test files (see
[`src/App.test.js`](src/App.test.js)). Import test APIs explicitly from `vitest`.
The shared setup in `tests/setup.js` automatically unmounts Vue Test Utils
wrappers after each test. Keep tests next to their source as `*.test.js`, or in
`tests/`.

ESLint checks JavaScript and Vue files with recommended JavaScript rules and
Vue's essential correctness rules. Dependencies, build output, coverage, and
internal planning documents are excluded. No formatter is required.

The test dependencies stay on Vue Test Utils 2.4 and jsdom 29 to support the
minimum Node.js 24.12.0 version.

Real-browser checks and reproduction commands are in
[`tests/browser/README.md`](tests/browser/README.md). The dated Chromium/Firefox
reuse and accessibility matrix, including pending manual checks and guidance for
hosts with multiple Vue app roots, is in [`docs/acceptance.md`](docs/acceptance.md).

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

Output: `dist/`. Open
[http://localhost:4173/vue-compound-interest-calculator/](http://localhost:4173/vue-compound-interest-calculator/)
for production preview. Local and Docker development continue to use `/`.
The preview server is for local checks only.

## GitHub Pages

In **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**.
The existing [workflow](.github/workflows/pages.yml) runs lint, tests, and a build
for pull requests and pushes to `main`, then deploys `dist/` from `main` after
successful checks.

Expected URL: <https://przemyslaw-naruszewicz.github.io/vue-compound-interest-calculator/>.
If the repository name or domain changes, update the production base in `vite.config.js`.

Pages setup and live-site verification are pending; see the
[verification record](docs/acceptance.md#pages-build-and-ci-preparation).
