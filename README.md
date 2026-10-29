# Vue Compound Interest Calculator

A Vue 3 + Vite demo and reusable component for exploring savings with monthly
contributions. Results update as you edit. The UI is in English; number formatting
defaults to `pl-PL` / `PLN`.

## Calculation and inputs

The model uses a constant nominal annual return, divided by 12 for monthly
compounding. Each month earns interest before the month-end contribution is added.
It excludes taxes, fees, inflation and market volatility. Results are illustrative,
not guaranteed returns or investment advice. Negative returns are outside the
input range, although real investments can lose value.

| Input | Default | Inclusive range | Step |
| --- | --- | --- | --- |
| Initial investment | 10000 | 0–1000000000 | 0.01 |
| Monthly contribution | 500 | 0–1000000000 | 0.01 |
| Duration (years) | 10 | 1–40 | 1 |
| Annual nominal return (%) | 7 | 0–15 | 0.1 |

Amounts accept whole numbers or up to two decimal places with a dot or comma
(`1234.56` or `1234,56`); surrounding whitespace is ignored. Grouping separators,
signs and scientific notation are unsupported. Duration and return use sliders.
Empty, incomplete (`1.`), malformed or out-of-range values keep the draft visible,
show a field error and hide results until all inputs are valid again.

Results contain invested capital, final value and gain. Calculations retain
JavaScript number precision; only displayed amounts are rounded by currency
formatting. At zero return, final value equals invested capital and gain is zero.
With both amounts zero, all totals are zero and the breakdown shows an empty-state
explanation.

## Run and stop

Use Docker with Docker Compose, or Node.js **24.12+ within 24.x** and npm
(`engines.node`: `^24.12.0`). Dependency installation needs internet access.

With Docker:

```sh
docker compose up
```

Open [http://localhost:5173](http://localhost:5173). Dependencies install
automatically and source changes reload. Stop with `Ctrl+C`, then
`docker compose down`. Override the port with `VUE_PORT=5174 docker compose up`.

Locally:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite; stop with `Ctrl+C`.

## Check and build

```sh
npm test
npm run test:watch
npm run lint
npm run build
npm run preview
```

`test` runs Vitest once; `test:watch` reruns tests as files change (stop with
`Ctrl+C`). Lint permits no warnings. Build writes static files to `dist/`.
Preview serves them at
[http://localhost:4173/vue-compound-interest-calculator/](http://localhost:4173/vue-compound-interest-calculator/);
stop with `Ctrl+C`. Preview is for local verification; production hosting serves
`dist/` through a static web host.

With Docker running, use `docker compose exec vue npm test`,
`docker compose exec vue npm run lint` and `docker compose exec vue npm run build`.
The same prefix supports `npm run test:watch`; run preview locally as above.
Development uses `/`; build and preview use `/vue-compound-interest-calculator/`.

Browser reproduction commands are in [tests/browser/README.md](tests/browser/README.md).
The [acceptance record](docs/acceptance.md) reports performed checks and the
pending manual screen-reader and native browser zoom checks.

## Code boundaries

Under `src/features/investment-calculator/`, `domain/` holds pure validation and
calculations, `composables/` owns each instance's reactive drafts and derived
results, `utils/` parses amounts and formats currency, and `components/` presents
the form, summary and breakdown. `InvestmentCalculator.vue` is the public wrapper,
exported by `src/index.js`. `src/App.vue` and `src/style.css` provide the demo shell.
There is no backend, API or persistence layer.

## Reuse in a Vue app

Copy `src/index.js` and the **entire** `src/features/` tree together into
`src/vendor/investment-calculator/` in your host project, preserving relative
paths. The host needs Vue **3.5+** and Vue SFC tooling (for example, Vite with
`@vitejs/plugin-vue`). Scoped component styles are included; demo CSS and bootstrap
files are unnecessary. This is source reuse, not an npm package or plain-script embed.

Example host `src/App.vue`:

```vue
<script setup>
import { ref } from 'vue'
import { InvestmentCalculator } from './vendor/investment-calculator/index.js'

const projection = ref(null)

function handleResultChange(result) {
  projection.value = result
}
</script>

<template>
  <InvestmentCalculator
    :default-initial-investment="10000"
    :default-monthly-contribution="500"
    :default-duration-years="10"
    :default-annual-return="7"
    locale="en-US"
    currency="USD"
    @result-change="handleResultChange"
  />
  <p v-if="projection">Invested capital: {{ projection.investedCapital }}</p>
  <p v-else>Correct the highlighted inputs to see a projection.</p>
</template>
```

| Prop | Type | Default |
| --- | --- | --- |
| `defaultInitialInvestment` | Number | `10000` |
| `defaultMonthlyContribution` | Number | `500` |
| `defaultDurationYears` | Number | `10` |
| `defaultAnnualReturn` | Number | `7` |
| `locale` | String | `'pl-PL'` |
| `currency` | String | `'PLN'` |

The four `default*` props seed local state **once**; later changes do not overwrite
edits. Pass numbers within the input limits above. Invalid defaults show errors
until the user corrects them; they are not clamped. To intentionally reset, change
the component's Vue `:key` to remount it with the current defaults.

`locale` and `currency` update formatting and currency labels immediately without
changing drafts or calculations. The UI remains English. Currency changes are
display-only: no exchange-rate conversion occurs. Unsupported/malformed locales
fall back to `pl-PL`; currencies must be three uppercase ASCII letters or fall
back to `PLN`. Fallbacks are independent and show an explanatory notice.

`result-change` emits a fresh object of unrounded numbers:

```js
{ investedCapital, finalValue, investmentGain }
```

`investedCapital` is initial investment plus all contributions; `investmentGain`
is final value minus invested capital. An initial event fires during setup with
the result or `null` if defaults are invalid. Changed valid numeric parameters
emit a result, even if totals stay the same. Becoming invalid emits `null` once;
further invalid edits emit nothing. Recovery emits a result again. Equivalent
drafts (`500`, `500.00`, `500,00`) do not emit duplicates. Synchronous edits within
one Vue update cycle are batched into one event for the final state. Formatting
changes do not emit. Parent handlers must accept `null`, as in the example.

Instances have independent state and IDs within one Vue app. If the host creates
multiple Vue app roots on one page, assign a distinct `app.config.idPrefix` to
**each** app before mounting, for example `app.config.idPrefix = 'savings-primary'`
and `otherApp.config.idPrefix = 'savings-secondary'`.

## GitHub Pages

Select **Settings → Pages → Build and deployment → Source → GitHub Actions**.
The existing [workflow](.github/workflows/pages.yml) runs lint, tests and build
for PRs and pushes to `main`, then deploys `dist/` after successful checks on `main`.

Production base: `/vue-compound-interest-calculator/`. Update `base` in
[vite.config.js](vite.config.js) if the repository name or domain changes.

Publication and hosted CI verification are **pending**; see the
[verification record](docs/acceptance.md#pages-build-and-ci-preparation).
