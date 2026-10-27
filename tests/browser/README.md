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
