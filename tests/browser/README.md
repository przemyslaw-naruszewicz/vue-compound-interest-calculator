# Investment form browser checks

The host connects `InvestmentForm` to `useInvestmentCalculator` without the demo
or its global styles. It renders two instances, including invalid slider seeds,
and places the first instance inside a real host form.

To inspect it interactively, run `npm run dev` and open
`http://localhost:5173/tests/browser/investment-form.html` (use the actual Vite port).

The automated checks use Puppeteer and Chromium from a pinned Docker image;
they do not add project dependencies. Build the host from the repository root:

```sh
node --input-type=module -e 'import { build } from "vite"; await build({ build: { outDir: "/tmp/investment-form-browser", emptyOutDir: true, rollupOptions: { input: "tests/browser/investment-form.html" } } });'
mkdir -p /tmp/investment-form-artifacts
```

Run the checks (the first run may need to download the image):

```sh
docker run --rm --network none --user 0:0 \
  --mount type=bind,src="$PWD/tests/browser",dst=/checks,readonly \
  --mount type=bind,src=/tmp/investment-form-browser,dst=/build,readonly \
  --mount type=bind,src=/tmp/investment-form-artifacts,dst=/artifacts \
  --env NODE_PATH=/home/mermaidcli/node_modules \
  --env FORM_ARTIFACT_DIR=/artifacts \
  --entrypoint node \
  ghcr.io/mermaid-js/mermaid-cli/mermaid-cli:11.16.0 \
  /checks/check-investment-form.mjs /build
```

Checks cover native Arrow/Home/End slider behavior, tab order, preserved focus
and caret during validation, focus outlines, 44 px control targets, Enter
isolation from the host form, recovery from invalid seeds, independent IDs,
and overflow at 320, 640, and 1280 px. Screenshots are saved under
`/tmp/investment-form-artifacts`. The script exits with a nonzero status on failure.

This is a Chromium check. It does not replace screen-reader testing or a
Firefox/Safari acceptance pass.

## Investment results checks

The results host connects the form, composable, summary, and breakdown without
demo styles. It includes interactive locale/currency settings, positive capital
with zero return, an empty investment, and the maximum model magnitude.
Open `http://localhost:5173/tests/browser/investment-results.html` with Vite
running, or build the isolated host:

```sh
node --input-type=module -e 'import { build } from "vite"; await build({ build: { outDir: "/tmp/investment-results-browser", emptyOutDir: true, rollupOptions: { input: "tests/browser/investment-results.html" } } });'
mkdir -p /tmp/investment-results-artifacts
```

Run Chromium checks using the same image:

```sh
docker run --rm --network none --user 0:0 \
  --mount type=bind,src="$PWD/tests/browser",dst=/checks,readonly \
  --mount type=bind,src=/tmp/investment-results-browser,dst=/build,readonly \
  --mount type=bind,src=/tmp/investment-results-artifacts,dst=/artifacts \
  --env NODE_PATH=/home/mermaidcli/node_modules \
  --env RESULTS_ARTIFACT_DIR=/artifacts \
  --entrypoint node \
  ghcr.io/mermaid-js/mermaid-cli/mermaid-cli:11.16.0 \
  /checks/check-investment-results.mjs /build
```

The script verifies PLN/USD/JPY formatting, independent fallbacks, preserved
decimal drafts, invalid-input recovery, zero states, bounded proportions,
bar semantics, text contrast of at least 4.5:1, and no overflow at 320, 640, and
1280 px. It saves full-page and summary screenshots in
`/tmp/investment-results-artifacts/`. No external fonts or data are loaded.

## Public component checks

This host imports only `InvestmentCalculator` from `src/index.js`, without demo
styles. It renders an interactive instance with a parent listener that mutates
received payloads, an instance with invalid defaults (including a numeric string),
and an instance with maximum values. The production build verifies runtime
validation without Vue's development-only prop warnings.

To inspect the host interactively, open
`http://localhost:5173/tests/browser/public-component.html` with Vite running.
The intentionally invalid prop type produces a Vue warning in development.
For automated checks, build the host and prepare the artifact directory:

```sh
node --input-type=module -e 'import { build } from "vite"; await build({ build: { outDir: "/tmp/public-component-browser", emptyOutDir: true, rollupOptions: { input: "tests/browser/public-component.html" } } });'
mkdir -p /tmp/public-component-artifacts
```

Run Chromium against the production host:

```sh
docker run --rm --network none --user 0:0 \
  --mount type=bind,src="$PWD/tests/browser",dst=/checks,readonly \
  --mount type=bind,src=/tmp/public-component-browser,dst=/build,readonly \
  --mount type=bind,src=/tmp/public-component-artifacts,dst=/artifacts \
  --env NODE_PATH=/home/mermaidcli/node_modules \
  --env PUBLIC_ARTIFACT_DIR=/artifacts \
  --entrypoint node \
  ghcr.io/mermaid-js/mermaid-cli/mermaid-cli:11.16.0 \
  /checks/check-public-component.mjs /build
```

Checks cover the initial parent notification, equivalent drafts, invalid-state
deduplication, recovery, payload isolation, independent instances and IDs,
reactive formatting and fallbacks, ignored default changes, keyed remounts,
keyboard slider recovery, focus outlines, validity messages, financial
explanations, unrelated host styles, and overflow at 320, 640, and 1280 px.
Screenshots include invalid defaults at 320 px and the full host at each width.
The script fails on browser warnings or errors. This check does not replace
screen-reader testing or Firefox/Safari acceptance.
