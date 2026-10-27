import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdir, readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { extname, join } from 'node:path'
import process from 'node:process'

const puppeteer = createRequire(import.meta.url)('puppeteer')
const buildDirectory = process.argv[2] || '/tmp/public-component-browser'
const artifactDirectory = process.env.PUBLIC_ARTIFACT_DIR || '/tmp/public-component-artifacts'
const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname
  try {
    const body = await readFile(join(buildDirectory, path))
    response.writeHead(200, { 'Content-Type': mimeTypes[extname(path)] || 'application/octet-stream' })
    response.end(body)
  } catch {
    response.writeHead(404)
    response.end()
  }
})

server.listen(0, '127.0.0.1')
await once(server, 'listening')
let browser

try {
  browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warn') errors.push(message.text())
  })
  await page.setViewport({ width: 1280, height: 900 })
  await page.goto(`http://127.0.0.1:${server.address().port}/tests/browser/public-component.html`)
  await page.waitForSelector('[data-test="interactive"] dd')

  const host = '[data-test="interactive"]'
  const invalid = '[data-test="invalid"]'
  const input = (field, instance = host) => `${instance} input[id$="-${field}"]`
  const text = (selector) => page.$eval(selector, (element) => element.textContent.trim())
  const events = async (selector = '[data-test="events"]') => JSON.parse(await text(selector))
  const edit = async (field, value, instance = host) => {
    await page.focus(input(field, instance))
    await page.$eval(input(field, instance), (element, value) => {
      element.value = value
      element.setSelectionRange(value.length, value.length)
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }))
    }, value)
  }
  const original = await events()
  assert.equal(original.length, 1)
  assert.equal(original[0].investedCapital, 70000)
  assert.ok(Math.abs(original[0].finalValue - 106639.0174837243) < 0.000001)
  assert.equal((await text(`${host} dd`)).includes('-1'), false)
  assert.deepEqual(await events('[data-test="invalid-events"]'), [null])
  assert.equal(await page.$$eval(`${invalid} [aria-invalid="true"]`, (elements) => elements.length), 3)
  assert.equal(await page.$(`${invalid} dd`), null)
  assert.match(await text(`${invalid} .investment-calculator__status`), /Projection unavailable/)
  await mkdir(artifactDirectory, { recursive: true })
  await page.setViewport({ width: 320, height: 900 })
  await (await page.$(invalid)).screenshot({ path: join(artifactDirectory, 'invalid-defaults-320.png') })
  await page.setViewport({ width: 1280, height: 900 })

  await edit('monthlyContribution', '500.00')
  assert.deepEqual(await events(), original)
  await edit('initialInvestment', '1234,56')
  const edited = await events()
  assert.equal(edited.length, 2)
  assert.equal(edited[1].investedCapital, 61234.56)
  const ids = await page.$$eval('[id]', (elements) => elements.map((element) => element.id))
  assert.equal(new Set(ids).size, ids.length)
  assert.equal(await page.$$eval('.investment-calculator h1', (elements) => elements.length), 0)
  assert.equal(await page.$$eval('.investment-calculator__assumptions', (elements) => (
    elements.every((element) => /constant nominal annual return, compounded monthly/.test(element.textContent)
      && /contributions at month-end/.test(element.textContent)
      && /Excludes taxes, fees and inflation/.test(element.textContent)
      && /Actual returns\s+vary and may be negative/.test(element.textContent)
      && /not a guarantee or investment advice/.test(element.textContent))
  )), true)
  assert.equal(await page.$eval('[data-test="host-text"]', (element) => {
    const style = getComputedStyle(element)
    return style.fontFamily === getComputedStyle(document.body).fontFamily
      && style.color === 'rgb(0, 0, 0)' && style.boxSizing === 'content-box'
  }), true)

  for (const [locale, currency, effectiveLocale, effectiveCurrency] of [
    ['en-US', 'USD', 'en-US', 'USD'], ['ja-JP', 'JPY', 'ja-JP', 'JPY'],
    ['bad_locale', 'USD', 'pl-PL', 'USD'], ['en-US', 'bad', 'en-US', 'PLN'],
  ]) {
    await page.select('[data-test="locale"]', locale)
    await page.select('[data-test="currency"]', currency)
    assert.deepEqual(await events(), edited)
    const expected = await page.evaluate((locale, currency, value) => (
      new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value)
    ), effectiveLocale, effectiveCurrency, edited.at(-1).finalValue)
    assert.equal(await text(`${host} dd`), expected)
    assert.match(await text(`${host} label`), new RegExp(`\\(${effectiveCurrency}\\)`))
    assert.equal(await page.$eval(input('initialInvestment'), (element) => element.value), '1234,56')
  }
  await page.click('[data-test="change-defaults"]')
  assert.deepEqual(await events(), edited)
  assert.equal(await page.$eval(input('initialInvestment'), (element) => element.value), '1234,56')
  assert.equal(await page.$eval(input('durationYears'), (element) => element.value), '10')

  await edit('initialInvestment', '1.')
  assert.equal((await events()).at(-1), null)
  assert.equal(await page.$(`${host} dd`), null)
  const invalidCount = (await events()).length
  await page.keyboard.press('.')
  assert.equal((await events()).length, invalidCount)
  assert.equal(await text(`${host} .investment-calculator__status`),
    'Projection unavailable. Correct the highlighted investment parameters.')
  assert.equal(await page.$eval(input('initialInvestment'), (element) => (
    document.activeElement === element && getComputedStyle(element).outlineStyle === 'solid'
  )), true)
  await edit('initialInvestment', '1234,56')
  assert.equal((await events()).length, invalidCount + 1)
  assert.deepEqual((await events()).at(-1), edited.at(-1))
  assert.equal(await text(`${host} .investment-calculator__status`), 'Projection available.')

  await edit('initialInvestment', '10000', invalid)
  for (const [field, key] of [['durationYears', 'Home'], ['annualReturn', 'Home']]) {
    await page.focus(input(field, invalid))
    await page.keyboard.press(key)
  }
  assert.equal(await page.$$eval(`${invalid} [aria-invalid="true"]`, (elements) => elements.length), 0)
  assert.equal((await events('[data-test="invalid-events"]')).length, 2)
  assert.equal(await text(`${invalid} .investment-calculator__status`), 'Projection available.')

  for (const width of [320, 640, 1280]) {
    await page.setViewport({ width, height: 900 })
    assert.equal(await page.evaluate(() => (
      document.documentElement.scrollWidth <= document.documentElement.clientWidth
      && [...document.querySelectorAll('.investment-calculator, .investment-calculator p, .investment-summary dd')]
        .every((element) => element.scrollWidth <= element.clientWidth + 1)
    )), true, `Overflow at ${width}px`)
    await page.screenshot({ path: join(artifactDirectory, `public-component-${width}.png`), fullPage: true })
  }
  await page.click('[data-test="remount"]')
  assert.equal(await page.$eval(input('initialInvestment'), (element) => element.value), '1234.56')
  assert.equal(await page.$eval(input('durationYears'), (element) => element.value), '3')
  assert.equal((await events()).length, invalidCount + 2)
  assert.deepEqual(errors, [])
  process.stdout.write(`Chromium ${await browser.version()}: production public API, initial listener, runtime validation, events, payload isolation, prop lifecycle, formatting, validity status, keyboard recovery, scoped styles and responsive checks passed.\n`)
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
}
