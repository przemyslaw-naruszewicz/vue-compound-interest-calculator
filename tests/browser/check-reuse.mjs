import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { extname, join, resolve } from 'node:path'
import process from 'node:process'

const require = createRequire(import.meta.url)
const puppeteer = require('puppeteer')
const buildDirectory = resolve(process.argv[2] || '/tmp/calculator-reuse-browser')
const artifactDirectory = process.env.REUSE_ARTIFACT_DIR || '/tmp/calculator-reuse-artifacts'
const engines = process.argv.slice(3)
if (!engines.length) engines.push('chrome', 'firefox')
assert.ok(engines.every((engine) => ['chrome', 'firefox'].includes(engine)), 'Use chrome or firefox')
const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }
const server = createServer(async (request, response) => {
  const path = resolve(buildDirectory, `.${new URL(request.url, 'http://localhost').pathname}`)
  try {
    assert.ok(path.startsWith(`${buildDirectory}/`))
    const body = await readFile(path)
    response.writeHead(200, { 'Content-Type': mimeTypes[extname(path)] || 'application/octet-stream' })
    response.end(body)
  } catch {
    response.writeHead(404)
    response.end()
  }
})

server.listen(0, '127.0.0.1')
await once(server, 'listening')
await mkdir(artifactDirectory, { recursive: true })

async function checkBrowser(engine) {
  const report = {
    date: new Date().toISOString(), engine,
    node: process.version, puppeteer: require('puppeteer/package.json').version,
    passed: [], pending: ['Native browser zoom', 'Screen-reader speech and navigation'],
  }
  let browser
  let page
  try {
    browser = await puppeteer.launch({
      browser: engine,
      executablePath: engine === 'firefox'
        ? process.env.FIREFOX_EXECUTABLE_PATH || '/usr/bin/firefox-esr'
        : process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
      headless: true,
      args: engine === 'chrome' ? ['--no-sandbox', '--disable-dev-shm-usage'] : [],
      extraPrefsFirefox: engine === 'firefox' ? { 'ui.prefersReducedMotion': 1 } : undefined,
    })
    report.browser = await browser.version()
    page = await browser.newPage()
    const errors = []
    const externalRequests = []
    const target = `http://127.0.0.1:${server.address().port}/tests/browser/reuse.html`
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (['error', 'warn'].includes(message.type())) errors.push(message.text())
    })
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (['http:', 'https:'].includes(url.protocol) && url.origin !== new URL(target).origin) {
        externalRequests.push(request.url())
      }
    })
    const root = (instance = 'first') => `[data-test="${instance}"]`
    const input = (field, instance = 'first') => `${root(instance)} input[id$="-${field}"]`
    const text = (selector) => page.$eval(selector, (element) => element.textContent.trim())
    const events = async (instance = 'first') => JSON.parse(await text(`[data-test="${instance}-events"]`))
    const totals = (instance = 'first') => page.$$eval(`${root(instance)} dd`, (elements) => (
      elements.map((element) => element.textContent.trim())
    ))
    const state = async (instance) => ({
      html: await page.$eval(root(instance), (element) => element.outerHTML), events: await events(instance),
    })
    const screenshot = (name) => page.screenshot({
      path: join(artifactDirectory, `${engine}-${name}.png`), fullPage: true,
    })
    const formatted = (values, locale = 'pl-PL', currency = 'PLN') => page.evaluate(
      (values, locale, currency) => values.map((value) => (
        new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value)
      )), values, locale, currency,
    )
    const keyboardEdit = async (field, value, instance = 'first') => {
      await page.focus(input(field, instance))
      await page.keyboard.down('Control')
      await page.keyboard.press('A')
      await page.keyboard.up('Control')
      await page.keyboard.press('Backspace')
      await page.keyboard.type(value)
    }
    const pasteDraft = async (field, value) => {
      await page.focus(input(field))
      await page.$eval(input(field), (element, value) => {
        element.value = value
        element.setSelectionRange(value.length, value.length)
        element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }))
      }, value)
    }
    const checkAssociations = async () => assert.equal(await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map((element) => element.id)
      return ids.length === new Set(ids).size
        && [...document.querySelectorAll('.investment-calculator')].every((calculator) => (
          [...calculator.querySelectorAll('input')].every((element) => {
            const descriptions = element.getAttribute('aria-describedby').split(' ')
            return element.labels.length === 1 && calculator.contains(element.labels[0])
              && descriptions.length === (element.getAttribute('aria-invalid') === 'true' ? 2 : 1)
              && descriptions.every((id) => {
                const description = document.getElementById(id)
                return calculator.contains(description) && description.textContent.trim().length > 0
              })
          }) && calculator.contains(document.getElementById(
            calculator.querySelector('section').getAttribute('aria-labelledby'),
          ))
        ))
    }), true, 'Unique, instance-local label/help/error/heading associations')
    const checkLayout = async (label) => {
      const layout = await page.evaluate(() => ({
        pageFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        legendsFit: [...document.querySelectorAll('.investment-form')].every((form) => {
          const box = form.getBoundingClientRect()
          const title = form.querySelector('legend').getBoundingClientRect()
          const fields = form.querySelector('.investment-form__fields').getBoundingClientRect()
          const style = getComputedStyle(form)
          return title.top >= box.top + parseFloat(style.paddingTop)
            && title.left >= box.left + parseFloat(style.paddingLeft)
            && title.right <= box.right - parseFloat(style.paddingRight) + 1
            && title.bottom < fields.top
        }),
        overflowing: [...document.querySelectorAll('.investment-calculator, .investment-calculator *')]
          .filter((element) => element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1)
          .map((element) => ({ tag: element.tagName, className: element.className, width: element.clientWidth, scroll: element.scrollWidth })),
        controlsFit: [...document.querySelectorAll('.investment-calculator input')].every((element) => {
          const bounds = element.getBoundingClientRect()
          return bounds.width >= 44 && bounds.height >= 44
            && bounds.left >= 0 && bounds.right <= document.documentElement.clientWidth
        }),
      }))
      assert.deepEqual(layout, { pageFits: true, legendsFit: true, overflowing: [], controlsFit: true }, `Layout, readable content and touch targets: ${label}`)
      for (const element of await page.$$('.investment-calculator input, .investment-calculator dd, .investment-form__error')) {
        await element.evaluate((node) => node.scrollIntoView({ block: 'center' }))
        assert.equal(await element.isIntersectingViewport(), true, `Reachable content: ${label}`)
      }
    }
    const checkFocus = async (field, instance = 'first') => {
      const focus = await page.$eval(input(field, instance), (element) => ({
        active: document.activeElement === element,
        outline: getComputedStyle(element).outlineStyle,
        width: getComputedStyle(element).outlineWidth,
      }))
      assert.deepEqual(focus, { active: true, outline: 'solid', width: '3px' }, `Visible keyboard focus: ${field}`)
    }
    const checkContrast = async () => {
      const ratios = await page.$$eval('.investment-calculator', (calculators) => {
        const luminance = (color) => {
          const [r, g, b] = color.match(/[\d.]+/g).slice(0, 3).map(Number).map((channel) => {
            const value = channel / 255
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
          })
          return r * 0.2126 + g * 0.7152 + b * 0.0722
        }
        const contrast = (first, second) => {
          const a = luminance(first)
          const b = luminance(second)
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
        }
        const background = (element) => {
          while (element) {
            const color = getComputedStyle(element).backgroundColor
            if (color !== 'rgba(0, 0, 0, 0)') return color
            element = element.parentElement
          }
          return 'rgb(255, 255, 255)'
        }
        return calculators.flatMap((calculator) => [...calculator.querySelectorAll('*')].flatMap((element) => {
          const style = getComputedStyle(element)
          const results = []
          const add = (kind, ratio, minimum) => results.push({ kind, ratio, minimum })
          if ([...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim())) {
            add('text', contrast(style.color, background(element)), 4.5)
          }
          if (element.matches('input')) {
            const adjacent = background(element.parentElement)
            if (element.type === 'text') {
              add('input text', contrast(style.color, background(element)), 4.5)
              add('input border', contrast(style.borderColor, adjacent), 3)
            }
            if (element.type === 'range') add('slider accent', contrast(style.accentColor, adjacent), 3)
            if (style.outlineStyle === 'solid') add('focus outline', contrast(style.outlineColor, adjacent), 3)
          }
          return results
        }))
      })
      assert.ok(ratios.length > 0)
      assert.deepEqual(ratios.filter(({ ratio, minimum }) => ratio < minimum), [], 'Text/control contrast')
      return ratios
    }

    await page.setViewport({ width: 1280, height: 900 })
    await page.goto(target)
    await page.waitForSelector(`${root()} dd`)
    const original = await events()
    assert.equal(original.length, 1)
    assert.equal(original[0].investedCapital, 70000)
    assert.ok(Math.abs(original[0].finalValue - 106639.0174837243) < 0.000001)
    assert.deepEqual(await totals(), await formatted([106639.02, 70000, 36639.02]))
    const secondInitial = await events('second')
    assert.equal(secondInitial.length, 1)
    assert.deepEqual(await totals('second'), await formatted(
      [secondInitial[0].finalValue, secondInitial[0].investedCapital, secondInitial[0].investmentGain], 'en-US', 'USD',
    ))
    for (const [field, value] of [
      ['initialInvestment', '1234.56'], ['monthlyContribution', '78.91'],
      ['durationYears', '3'], ['annualReturn', '4.2'],
    ]) assert.equal(await page.$eval(input(field, 'second'), (element) => element.value), value)
    const second = await state('second')
    const unchangedSecond = async () => assert.deepEqual(await state('second'), second, 'Independent second instance')
    await checkAssociations()
    await checkLayout('desktop defaults')
    await screenshot('desktop')
    report.passed.push('Default reference results, two independent initial parent notifications')

    assert.equal(await page.evaluate(() => {
      const heading = getComputedStyle(document.querySelector('[data-test="host-heading"]'))
      const control = getComputedStyle(document.querySelector('[data-test="host-input"]'))
      const body = getComputedStyle(document.body)
      return heading.fontFamily === body.fontFamily && heading.fontSize === '32px'
        && heading.color === 'rgb(0, 0, 0)' && heading.boxSizing === 'content-box'
        && control.width === '160px' && control.boxSizing === 'content-box'
        && document.querySelector('[data-test="host-input"]').getBoundingClientRect().height < 44
    }), true, 'Neighboring host heading/input retain their styles')
    report.passed.push('Public export only, no demo CSS/bootstrap/aliases/stores; host styles preserved')

    await page.focus(input('initialInvestment'))
    for (const [field, instance] of [
      ['initialInvestment', 'first'], ['monthlyContribution', 'first'],
      ['durationYears', 'first'], ['annualReturn', 'first'],
      ['initialInvestment', 'second'], ['monthlyContribution', 'second'],
      ['durationYears', 'second'], ['annualReturn', 'second'],
    ]) {
      await checkFocus(field, instance)
      await page.keyboard.press('Enter')
      await page.keyboard.press('Tab')
      if (field === 'annualReturn') {
        assert.equal(await page.$eval(`${root(instance)} .one-time-contributions__add`, (element) => (
          document.activeElement === element && getComputedStyle(element).outlineStyle === 'solid'
        )), true, 'Contribution button follows the parameter controls')
        await page.keyboard.press('Tab')
      }
    }
    assert.equal(await text('[data-test="submissions"]'), '0')
    assert.equal(page.url(), target)
    await page.keyboard.press('Enter')
    assert.equal(await text('[data-test="submissions"]'), '1', 'Host submit still works')
    await keyboardEdit('initialInvestment', '1234,56')
    await keyboardEdit('monthlyContribution', '78.91')
    const beforeSliders = await totals()
    for (const [field, expected] of [['durationYears', '11'], ['annualReturn', '7.1']]) {
      const before = await totals()
      await page.focus(input(field))
      await page.keyboard.press('ArrowRight')
      assert.equal(await page.$eval(input(field), (element) => element.value), expected)
      assert.notDeepEqual(await totals(), before)
      await checkFocus(field)
    }
    assert.notDeepEqual(await totals(), beforeSliders)
    await unchangedSecond()
    report.passed.push('Keyboard tab order, visible focus, Enter isolation, both decimals, both arrow-controlled sliders')

    const valid = (await events()).at(-1)
    for (const [locale, currency, effectiveLocale, effectiveCurrency] of [
      ['en-US', 'USD', 'en-US', 'USD'], ['bad_locale', 'USD', 'pl-PL', 'USD'],
      ['en-US', 'bad', 'en-US', 'PLN'], ['pl-PL', 'PLN', 'pl-PL', 'PLN'],
    ]) {
      const previousEvents = await events()
      await page.select('[data-test="first-locale"]', locale)
      await page.select('[data-test="first-currency"]', currency)
      assert.deepEqual(await totals(), await formatted(
        [valid.finalValue, valid.investedCapital, valid.investmentGain], effectiveLocale, effectiveCurrency,
      ))
      assert.equal(await page.$eval(input('initialInvestment'), (element) => element.value), '1234,56')
      assert.deepEqual(await events(), previousEvents)
      await unchangedSecond()
    }
    const beforeDefaults = await state('first')
    await page.click('[data-test="change-defaults"]')
    assert.deepEqual(await state('first'), beforeDefaults)
    await unchangedSecond()
    report.passed.push('Instance-local reactive formatting/fallbacks and ignored default-prop updates')

    await page.setViewport({ width: 320, height: 900 })
    const beforeInvalid = await events()
    for (const draft of ['1.', '', '-1', '1000000000.01']) {
      await pasteDraft('initialInvestment', draft)
      assert.deepEqual(await totals(), [])
      assert.equal((await events()).at(-1), null)
      assert.equal(await page.$(`${root()} .investment-breakdown`), null)
      assert.equal(await page.$eval(input('initialInvestment'), (element, draft) => (
        element.getAttribute('aria-invalid') === 'true' && element.value === draft
        && element.selectionStart === draft.length && element.selectionEnd === draft.length
      ), draft), true)
      await checkFocus('initialInvestment')
      await checkAssociations()
      await checkLayout(`320px invalid ${draft}`)
      await unchangedSecond()
    }
    report.contrast = await checkContrast()
    await screenshot('invalid-320')
    assert.equal((await events()).length, beforeInvalid.length + 1)
    assert.equal(await text(`${root()} .investment-calculator__status`),
      'Projection unavailable. Correct the highlighted investment parameters.')
    await keyboardEdit('initialInvestment', '1234,56')
    assert.deepEqual((await events()).at(-1), valid)
    assert.equal(await text(`${root()} .investment-calculator__status`), 'Projection available.')
    assert.equal(await page.$eval(input('monthlyContribution'), (element) => element.value), '78.91')
    await unchangedSecond()
    report.passed.push('Invalid drafts, unique local error associations, deduplicated invalid events and recovery')

    await page.focus(input('annualReturn'))
    await page.keyboard.press('Home')
    const capital = (await events()).at(-1).investedCapital
    assert.deepEqual(await totals(), await formatted([capital, capital, 0]))
    assert.match(await text(`${root()} .investment-breakdown__legend`), /Projected gain: 0.0%/)
    await keyboardEdit('initialInvestment', '0')
    await keyboardEdit('monthlyContribution', '0')
    assert.deepEqual(await totals(), await formatted([0, 0, 0]))
    assert.equal(await text(`${root()} .investment-breakdown__empty`), 'No invested capital or gain yet.')
    assert.equal(await page.$('[role="progressbar"], progress, meter, [role="alert"], [aria-live="assertive"]'), null)
    assert.equal(await page.$$eval('.investment-breakdown__track', (elements) => (
      elements.every((element) => element.getAttribute('aria-hidden') === 'true')
    )), true)
    assert.equal(await page.$$eval('.investment-summary', (elements) => (
      elements.every((element) => !element.hasAttribute('aria-live'))
    )), true)
    assert.equal(await page.$$eval('.investment-calculator__status', (elements) => (
      elements.every((element) => element.getAttribute('role') === 'status'
        && element.getAttribute('aria-live') === 'polite' && element.getAttribute('aria-atomic') === 'true')
    )), true)
    await unchangedSecond()
    report.passed.push('Zero return and zero amounts; labelled percentages without color or progress semantics; polite validity status')

    await keyboardEdit('initialInvestment', '1000000000')
    await keyboardEdit('monthlyContribution', '1000000000')
    for (const field of ['durationYears', 'annualReturn']) {
      await page.focus(input(field))
      await page.keyboard.press('End')
    }
    assert.equal((await events()).at(-1).investedCapital, 481000000000)
    assert.equal((await totals()).length, 3)
    for (const width of [320, 1280]) {
      await page.setViewport({ width, height: 900 })
      await checkLayout(`${width}px maximum values`)
      await screenshot(`maximum-${width}`)
    }
    await page.$eval('#app', (element) => { element.style.zoom = '2' })
    await page.setViewport({ width: 640, height: 900 })
    await checkLayout('200% CSS zoom, 640px viewport / 320px effective width')
    await page.focus(input('initialInvestment'))
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('ArrowLeft')
    await checkFocus('durationYears')
    await screenshot('zoom-200')
    await page.$eval('#app', (element) => { element.style.zoom = '' })
    if (engine === 'chrome') {
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    }
    assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true)
    assert.equal(await page.$$eval('.investment-calculator, .investment-calculator *', (elements) => (
      elements.every((element) => {
        const style = getComputedStyle(element)
        return style.animationName === 'none' && style.transitionDuration.split(',').every((value) => Number.parseFloat(value) === 0)
      })
    )), true, 'No calculator animations/transitions with reduced motion')
    await unchangedSecond()
    await checkAssociations()
    assert.deepEqual(errors, [], 'Browser warnings/errors')
    assert.deepEqual(externalRequests, [], 'Unexpected external requests')
    report.passed.push('Maximum values, 320px/desktop layout, 44px targets, 200% CSS zoom, reduced motion, clean console/network')
    await writeFile(join(artifactDirectory, `${engine}-report.json`), `${JSON.stringify(report, null, 2)}\n`)
    process.stdout.write(`${report.browser} (Puppeteer ${report.puppeteer}): all ${report.passed.length} acceptance groups passed.\n`)
  } catch (error) {
    report.failed = error.stack
    await page?.screenshot({ path: join(artifactDirectory, `${engine}-failure.png`), fullPage: true })
    await writeFile(join(artifactDirectory, `${engine}-report.json`), `${JSON.stringify(report, null, 2)}\n`)
    throw error
  } finally {
    await browser?.close()
  }
}

try {
  const failures = []
  for (const engine of engines) {
    try {
      await checkBrowser(engine)
    } catch (error) {
      failures.push(new Error(`${engine}: ${error.message}`, { cause: error }))
    }
  }
  if (failures.length) throw new AggregateError(failures, 'Browser acceptance failed')
} finally {
  await new Promise((resolve) => server.close(resolve))
}
