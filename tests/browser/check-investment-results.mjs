import assert from 'node:assert/strict'
import { once } from 'node:events'
import { readFile, mkdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { extname, join } from 'node:path'
import process from 'node:process'

const puppeteer = createRequire(import.meta.url)('puppeteer')
const buildDirectory = process.argv[2] || '/tmp/investment-results-browser'
const artifactDirectory = process.env.RESULTS_ARTIFACT_DIR || '/tmp'
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
  await page.setViewport({ width: 1280, height: 900 })
  await page.goto(`http://127.0.0.1:${server.address().port}/tests/browser/investment-results.html`)
  await page.waitForSelector('.investment-summary dd')

  const instance = '[data-test="interactive"]'
  const input = (field) => `${instance} input[id$="-${field}"]`
  const text = (selector) => page.$eval(selector, (element) => element.textContent)
  const totals = () => page.$$eval(`${instance} dd`, (elements) => elements.map((element) => element.textContent))
  const widths = (host = instance) => page.$$eval(`${host} .investment-breakdown__track > span`, (elements) => (
    elements.map((element) => Number.parseFloat(element.style.width))
  ))
  const setFormatting = async (locale, currency) => {
    await page.select('[data-test="locale"]', locale)
    await page.select('[data-test="currency"]', currency)
  }
  const editAmount = async (field, value) => {
    await page.focus(input(field))
    await page.keyboard.down('Control')
    await page.keyboard.press('A')
    await page.keyboard.up('Control')
    await page.keyboard.press('Backspace')
    await page.keyboard.type(value)
  }

  const referenceValues = [106639.02034474857, 70000, 36639.02034474857]
  const initialWidths = await widths()
  for (const [locale, currency] of [['pl-PL', 'PLN'], ['en-US', 'USD'], ['ja-JP', 'JPY']]) {
    await setFormatting(locale, currency)
    const expected = await page.evaluate((locale, currency, values) => {
      const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency })
      return values.map((value) => formatter.format(value))
    }, locale, currency, referenceValues)
    assert.deepEqual(await totals(), expected)
    assert.deepEqual(await widths(), initialWidths)
    assert.match(await text(`${instance} label`), new RegExp(`\\(${currency}\\)`))
  }

  await editAmount('initialInvestment', '1234,56')
  await editAmount('monthlyContribution', '78.91')
  const jpyTotals = await totals()
  assert.equal(jpyTotals.length, 3)
  assert.equal(jpyTotals.every((value) => !value.includes('.')), true)
  await setFormatting('bad_locale', 'USD')
  assert.match(await text(`${instance} [role="status"]`), /Using pl-PL/)
  assert.match(await text(`${instance} label`), /\(USD\)/)
  await setFormatting('en-US', 'bad')
  const notice = await text(`${instance} [role="status"]`)
  assert.match(notice, /Using PLN/)
  assert.doesNotMatch(notice, /Using pl-PL/)
  assert.match(await text(`${instance} label`), /\(PLN\)/)
  assert.equal(await page.$eval(input('initialInvestment'), (element) => element.value), '1234,56')
  assert.equal(await page.$eval(input('monthlyContribution'), (element) => element.value), '78.91')
  await setFormatting('bad_locale', 'bad')
  assert.match(await text(`${instance} [role="status"]`), /Using pl-PL.*Using PLN/s)

  await editAmount('initialInvestment', '1.')
  assert.deepEqual(await totals(), [])
  assert.equal(await page.$(`${instance} .investment-breakdown`), null)
  assert.match(await text(`${instance} .investment-summary`), /Correct the investment parameters/)
  await editAmount('initialInvestment', '1.50')
  assert.equal((await totals()).length, 3)
  assert.deepEqual(await widths('[data-test="zero-return"]'), [100, 0])
  assert.deepEqual(await widths('[data-test="empty"]'), [0, 0])
  assert.match(await text('[data-test="empty"] .investment-summary'), /No invested capital or gain yet\./)
  assert.equal(await page.$('[role="progressbar"], progress, meter'), null)
  assert.equal(await page.$$eval('.investment-breakdown__track', (tracks) => (
    tracks.every((track) => track.getAttribute('aria-hidden') === 'true')
  )), true)
  assert.equal(await page.$$eval('.investment-breakdown__track', (tracks) => tracks.every((track) => {
    const [invested, gain] = [...track.children].map((segment) => Number.parseFloat(segment.style.width))
    return Number.isFinite(invested) && Number.isFinite(gain)
      && invested >= 0 && gain >= 0 && invested <= 100 && gain <= 100
      // Chromium serializes CSS percentages with fewer digits than JS numbers.
      && (Math.abs(invested + gain - 100) < 0.0001 || invested + gain === 0)
  })), true)

  const contrasts = await page.$$eval(
    '.investment-summary h2, .investment-summary dt, .investment-summary dd, '
      + '.investment-breakdown__legend, .investment-breakdown__empty, .investment-summary__notice',
    (elements) => {
      const luminance = (color) => {
        const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map((channel) => {
          const value = channel / 255
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
        })
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
      }
      return elements.map((element) => {
        let backgroundElement = element
        let background = getComputedStyle(backgroundElement).backgroundColor
        while (background === 'rgba(0, 0, 0, 0)' && backgroundElement.parentElement) {
          backgroundElement = backgroundElement.parentElement
          background = getComputedStyle(backgroundElement).backgroundColor
        }
        const foreground = luminance(getComputedStyle(element).color)
        const backdrop = luminance(background)
        return (Math.max(foreground, backdrop) + 0.05) / (Math.min(foreground, backdrop) + 0.05)
      })
    },
  )
  assert.ok(contrasts.every((ratio) => ratio >= 4.5), `Insufficient text contrast: ${contrasts}`)

  await mkdir(artifactDirectory, { recursive: true })
  for (const width of [320, 640, 1280]) {
    await page.setViewport({ width, height: 900 })
    const layout = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      resultsFit: [...document.querySelectorAll('.investment-summary, .investment-summary dd')]
        .every((element) => {
          const rect = element.getBoundingClientRect()
          return rect.width > 0 && rect.left >= 0 && rect.right <= document.documentElement.clientWidth
            && element.scrollWidth <= element.clientWidth + 1
        }),
    }))
    assert.ok(layout.scrollWidth <= layout.width, `Horizontal overflow at ${width}px`)
    assert.equal(layout.resultsFit, true, `Result overflow at ${width}px`)
    await page.screenshot({ path: join(artifactDirectory, `investment-results-${width}.png`), fullPage: true })
    const maximum = await page.$('[data-test="maximum"] .investment-summary')
    await maximum.screenshot({ path: join(artifactDirectory, `maximum-summary-${width}.png`) })
  }

  await page.setViewport({ width: 320, height: 900 })
  const interactiveSummary = await page.$(`${instance} .investment-summary`)
  await interactiveSummary.screenshot({ path: join(artifactDirectory, 'fallback-summary-320.png') })
  const emptySummary = await page.$('[data-test="empty"] .investment-summary')
  await emptySummary.screenshot({ path: join(artifactDirectory, 'empty-summary-320.png') })
  await editAmount('initialInvestment', '')
  await interactiveSummary.screenshot({ path: join(artifactDirectory, 'unavailable-summary-320.png') })
  assert.doesNotMatch(await text('main'), /NaN|Infinity|-0[.,]/)
  assert.deepEqual(errors, [])
  process.stdout.write(`Chromium ${await browser.version()}: formatting, fallbacks, decimal drafts, unavailable/zero states, proportions, contrast and responsive checks passed.\n`)
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
}
