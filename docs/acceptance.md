# Independent reuse and browser acceptance

Acceptance run: **2026-10-28**. Automated integration and browser checks pass.
Manual screen-reader and native browser zoom checks remain **pending**. This
record does not claim a complete accessibility certification.

## Environment and reproduction

The production fixture at `tests/browser/reuse.html` mounts two calculators
through `src/index.js`, with different defaults and separate parent event
listeners. It imports no demo styles, application bootstrap, aliases, or stores.
The first calculator uses 10000 / 500 / 10 years / 7%, with `pl-PL` / `PLN`;
the second uses 1234.56 / 78.91 / 3 years / 4.2%, with `en-US` / `USD`.

| Tool | Version used |
| --- | --- |
| Local Node.js / npm | 24.22.1 / 11.19.1 |
| Vue / Vite / Vitest | 3.5.44 / 8.3.5 / 5.0.5 |
| Puppeteer | 24.43.1 |
| Chromium | 156.0.8078.47, headless Linux |
| Firefox ESR | 153.6.0, headless Linux, WebDriver BiDi |
| Browser tools image | `calculator-browser-checks:008`, built from `tests/browser/Dockerfile` |

Run `npm test`, `npm run lint`, and `npm run build` from the repository root.
Build and run the isolated production fixture using the commands in
[`tests/browser/README.md`](../tests/browser/README.md#independent-reuse-acceptance-chromium-and-firefox).
The Docker image keeps browser tooling outside the application's dependencies.
Browser packages come from Debian and may change on rebuild; use the generated
JSON reports to identify the versions actually tested.

This run's JSON reports and screenshots are in
`/tmp/calculator-reuse-acceptance-2026-10-28/`. Reproduction commands default to
`/tmp/calculator-reuse-artifacts/`; artifacts are local and are not committed.
Each engine writes its date, versions, passed groups, contrast measurements,
pending manual checks, and any failure to `<engine>-report.json`.

## Results

**Pass** means the named check was performed successfully. **Fail** means it
was performed and did not meet its expected result. **Pending** means it was
not performed; it is never counted as a pass.

| Check and steps | Chromium | Firefox | Evidence and scope |
| --- | --- | --- | --- |
| Load production fixture; read default results and initial events | Pass | Pass | First: 70000 invested, approximately 106639.02 final and 36639.02 gain. Second: USD 4075.32 invested, 4421.89 final and 346.57 gain. Exactly one initial notification per listener. |
| Edit both amounts with comma/dot decimals; use arrows on both sliders | Pass | Pass | Drafts, totals and first listener update; second calculator's complete markup and parent event history remain unchanged. |
| Paste `1.`, empty, `-1`, and `1000000000.01`; recover with `1234,56` | Pass | Pass | First results/bar disappear; associated error appears; focus/caret persist; consecutive invalid pastes emit only one null. Recovery restores the result and preserves the other draft. Second instance stays unchanged. |
| Change only first locale/currency, including invalid formatting settings | Pass | Pass | First formatting/fallbacks update without changing drafts, financial events, or the second instance. |
| Change first default props after local editing | Pass | Pass | Existing drafts and results stay intact; both event histories remain unchanged. |
| Check IDs, labels, help, errors and summary heading references | Pass | Pass | IDs are globally unique within the fixture; each reference resolves inside the correct calculator before, during and after validation. |
| Inspect neighboring host heading and input | Pass | Pass | Host font/color/box sizing and the small host input retain their own styles. Calculators render without demo CSS. |
| Tab across all eight calculator controls, use arrows, press Enter | Pass | Pass | Logical amount/amount/duration/return order in each instance; visible focus; Enter does not submit/reload the host. The host's own submit button still works. |
| Set return to zero, then both amounts to zero | Pass | Pass | Zero return gives zero gain; empty investment gives three zero totals and the neutral explanation. Second calculator stays unchanged. |
| Set both amounts to 1000000000, duration to 40, return to 15 | Pass | Pass | Finite totals, 481000000000 invested; results remain readable. |
| Check 320 px and 1280 px widths; scroll through controls, errors and results | Pass | Pass | No page/content horizontal overflow; all relevant content reachable. Calculator input areas meet 44 × 44 CSS px. Default desktop and narrow invalid/maximum states are covered. |
| Scale content with CSS zoom to 200% at 640 px viewport | Pass | Pass | Effective 320 px content width; no horizontal overflow/clipping; controls and results reachable; Tab and slider arrows work with visible focus. This is not native browser zoom. |
| Check rendered text and authored control/focus colors | Pass | Pass | Text minimum 6.07:1, input borders minimum 4.62:1, slider accent 6.42:1, focused input outline 7.54:1 against adjacent backgrounds. All sampled text meets 4.5:1, including large text. Native slider rendering also inspected in screenshots. |
| Enable reduced motion and inspect calculator styles | Pass | Pass | No calculator animations or nonzero transition durations. Chromium uses media emulation; Firefox starts with its reduced-motion preference enabled. |
| Inspect validity/status and breakdown semantics | Pass | Pass | Validity status is polite and atomic; results are not live regions; no alerts/assertive regions. Breakdown uses text labels/percentages and a patterned gain segment; visual track is hidden from assistive technology, with no progress role. Spoken behavior remains pending below. |
| Check console and network throughout | Pass | Pass | No runtime errors/warnings or external HTTP(S) requests. The local `data:` favicon needs no network. Tests run with Docker networking disabled. |
| Native browser UI zoom at 200% | Pending | Pending | Browser chrome was not available in the headless run. CSS scaling is separate evidence. |
| Screen-reader names, units, values, errors, status and results | Pending | Pending | No screen reader/audio interaction was available. DOM checks do not establish spoken behavior. |

No failed application checks remain in this run. No production feature changes
were needed. The remaining acceptance work is the two pending manual checks.
Other browser engines and operating-system themes were not tested.

The full unit/component suite passes **485 tests in 12 files**. Lint passes
without warnings and the production build succeeds. The three new integration
regressions are in `tests/fixtures/CalculatorReuseHost.test.js`: bidirectional
instance isolation (including simultaneous errors), local formatting/defaults,
and unique IDs across separate Vue app roots.

## Visual review

Screenshots from both engines were reviewed for desktop defaults, 320 px
validation errors and maximum values, and 200% CSS scaling. Review covers
hierarchy, readable wrapping, error placement, focus and native slider rendering.
The supporting filenames are `chrome-desktop.png`, `firefox-desktop.png`,
`<engine>-invalid-320.png`, `<engine>-maximum-320.png`,
`<engine>-maximum-1280.png`, and `<engine>-zoom-200.png`.

## Separate Vue app roots

Multiple component instances in one app receive unique IDs through Vue's
`useId()`. If a host creates multiple Vue apps on one page, give each app a
distinct `app.config.idPrefix` **before mounting**:

```js
import { createApp } from 'vue'
import { InvestmentCalculator } from './src/index.js'

const firstApp = createApp(InvestmentCalculator)
firstApp.config.idPrefix = 'savings-primary'
firstApp.mount('#primary-calculator')

const secondApp = createApp(InvestmentCalculator, { currency: 'USD', locale: 'en-US' })
secondApp.config.idPrefix = 'savings-secondary'
secondApp.mount('#secondary-calculator')
```

The integration test mounts two actual app roots with distinct prefixes and
verifies unique control/help/heading IDs. The two-instance browser fixture uses
one app root.

## Pending manual acceptance

Run `npm run dev` and open `/tests/browser/reuse.html`. Record the date,
operating system, browser and assistive-tool versions, actual outcome, and any
issue when completing these steps. Leave any unperformed step pending.

1. **Native zoom:** use the browser's own zoom menu to select 200%. At a desktop
   viewport, Tab through both calculators, operate both sliders, enter an invalid
   amount, recover, and inspect maximum totals. Confirm controls/errors/results
   remain readable and reachable without clipped content or page-level horizontal
   scrolling. Repeat in Chromium and Firefox; record the viewport and zoom.
2. **Screen reader:** use an available browser/screen-reader pair, such as Firefox
   with NVDA or Orca. Navigate through the fieldset and all four controls in both
   instances. Confirm the amount names include PLN/USD, duration includes years,
   return includes percent, and slider values are announced with units.
3. Enter `1.` in the first amount. Confirm invalid state, help and the corrective
   field error are associated with that control, and the polite unavailable
   status is understandable. Enter more invalid text, then recover with `1234,56`.
   Check that status messages are not repeatedly or assertively interrupting
   speech and that the second instance's result stays unchanged.
4. Read the projection's three named amounts and the textual breakdown in order.
   Confirm the bar is not announced as progress. Check zero amounts/zero return
   and recovery; verify that the results remain understandable without color.

Firefox's test profile requests reduced motion with `ui.prefersReducedMotion=1`,
as described in [Mozilla's reduced-motion documentation](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion#user_preferences).
