import assert from 'node:assert/strict'
import { once } from 'node:events'
import { readFile, mkdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { extname, join } from 'node:path'
import process from 'node:process'

const puppeteer = createRequire(import.meta.url)('puppeteer')
const buildDirectory = process.argv[2] || '/tmp/investment-form-browser'
const artifactDirectory = process.env.FORM_ARTIFACT_DIR || '/tmp'
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
  await page.goto(`http://127.0.0.1:${server.address().port}/tests/browser/investment-form.html`)
  await page.waitForSelector('input[type="range"]')

  const first = '[data-test="default-instance"]'
  const second = '[data-test="invalid-instance"]'
  const input = (instance, field) => `${instance} input[id$="-${field}"]`
  const value = (selector) => page.$eval(selector, (element) => element.value)
  const text = (selector) => page.$eval(selector, (element) => element.textContent)
  const selectAll = async () => {
    await page.keyboard.down('Control')
    await page.keyboard.press('A')
    await page.keyboard.up('Control')
  }
  const duration = input(first, 'durationYears')
  const rate = input(first, 'annualReturn')

  await page.keyboard.press('Tab')
  assert.equal(await page.$eval(input(first, 'initialInvestment'), (element) => (
    document.activeElement === element
  )), true)
  await selectAll()
  await page.keyboard.type('1.')
  assert.equal(await page.$eval(input(first, 'initialInvestment'), (element) => (
    document.activeElement === element && element.selectionStart === 2
      && element.getAttribute('aria-invalid') === 'true'
  )), true)
  await page.keyboard.type('5')
  assert.equal(await value(input(first, 'initialInvestment')), '1.5')
  assert.equal(await page.$eval(input(first, 'initialInvestment'), (element) => (
    document.activeElement === element && element.getAttribute('aria-invalid') === 'false'
  )), true)

  await page.keyboard.press('Tab')
  assert.equal(await page.$eval(input(first, 'monthlyContribution'), (element) => (
    document.activeElement === element
  )), true)
  await page.keyboard.press('Tab')
  assert.equal(await page.$eval(duration, (element) => document.activeElement === element), true)
  await page.keyboard.press('ArrowRight')
  assert.equal(await value(duration), '11')
  await page.keyboard.press('End')
  assert.equal(await value(duration), '40')
  await page.keyboard.press('Home')
  assert.equal(await value(duration), '1')
  assert.equal(await page.$eval(duration, (element) => element.getAttribute('aria-valuetext')), '1 year')

  await page.keyboard.press('Tab')
  assert.equal(await page.$eval(rate, (element) => document.activeElement === element), true)
  await page.keyboard.press('ArrowRight')
  assert.equal(await value(rate), '7.1')
  await page.keyboard.press('End')
  assert.equal(await value(rate), '15')
  await page.keyboard.press('Home')
  assert.equal(await value(rate), '0')
  await page.keyboard.press('ArrowRight')
  assert.equal(await value(rate), '0.1')
  assert.equal(await page.$eval(rate, (element) => element.getAttribute('aria-valuetext')), '0.1%')

  assert.match(await text(`${second} [data-test="validity"]`), /Unavailable/)
  const initialParameters = JSON.parse(await text(`${second} [data-test="parameters"]`))
  assert.equal(initialParameters.durationYears, 41)
  assert.equal(initialParameters.annualReturn, 7.05)
  for (const field of ['durationYears', 'annualReturn']) {
    const selector = input(second, field)
    assert.match(await page.$eval(selector, (element) => element.getAttribute('aria-valuetext')), /Unavailable/)
    await page.focus(selector)
    await page.keyboard.press('Home')
    assert.equal(await value(selector), field === 'durationYears' ? '1' : '0')
    assert.equal(await page.$eval(selector, (element) => element.getAttribute('aria-invalid')), 'false')
  }
  assert.equal(await text(`${second} [data-test="validity"]`), 'Valid parameters')

  for (const field of ['initialInvestment', 'monthlyContribution', 'durationYears', 'annualReturn']) {
    const selector = input(first, field)
    await page.focus(selector)
    await page.keyboard.press('Enter')
    assert.equal(await page.$eval(selector, (element) => document.activeElement === element), true)
    const appearance = await page.$eval(selector, (element) => {
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return {
        focusVisible: element.matches(':focus-visible'),
        outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth,
        width: rect.width, height: rect.height,
      }
    })
    assert.equal(appearance.focusVisible, true)
    assert.equal(appearance.outlineStyle, 'solid')
    assert.equal(appearance.outlineWidth, '3px')
    assert.ok(appearance.width >= 44 && appearance.height >= 44)
  }
  assert.equal(await text('[data-test="submissions"]'), 'Submissions: 0')
  assert.equal(await text('[data-test="enter-events"]'), 'Enter events: 0')
  await page.click('button[type="submit"]')
  assert.equal(await text('[data-test="submissions"]'), 'Submissions: 1')

  const ids = await page.$$eval('[id]', (elements) => elements.map((element) => element.id))
  assert.equal(new Set(ids).size, ids.length)
  await page.focus(input(first, 'initialInvestment'))
  await selectAll()
  await page.keyboard.type('1,000.00')
  await page.focus(input(first, 'monthlyContribution'))
  await selectAll()
  await page.keyboard.press('Backspace')

  await mkdir(artifactDirectory, { recursive: true })
  for (const width of [320, 640, 1280]) {
    await page.setViewport({ width, height: 900 })
    const layout = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      controlsFit: [...document.querySelectorAll('input')].every((element) => {
        const rect = element.getBoundingClientRect()
        return rect.width >= 44 && rect.height >= 44
          && rect.left >= 0 && rect.right <= document.documentElement.clientWidth
      }),
    }))
    assert.ok(layout.scrollWidth <= layout.width, `Horizontal overflow at ${width}px`)
    assert.equal(layout.controlsFit, true)
    await page.screenshot({ path: join(artifactDirectory, `investment-form-${width}.png`), fullPage: true })
  }
  assert.deepEqual(errors, [])
  process.stdout.write(`Chromium ${await browser.version()}: keyboard, focus, Enter, invalid recovery, IDs and responsive checks passed.\n`)
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
}

