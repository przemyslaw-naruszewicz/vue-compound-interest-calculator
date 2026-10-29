import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { extname, join, resolve } from 'node:path'
import process from 'node:process'

const puppeteer = createRequire(import.meta.url)('puppeteer')
const buildDirectory = resolve(process.argv[2] || '/tmp/calculator-contributions-browser')
const artifactDirectory = process.env.CONTRIBUTIONS_ARTIFACT_DIR || '/tmp/calculator-contributions-artifacts'
const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }
const server = createServer(async (request, response) => {
  const path = resolve(buildDirectory, `.${new URL(request.url, 'http://localhost').pathname}`)
  try {
    assert.ok(path.startsWith(`${buildDirectory}/`))
    response.writeHead(200, { 'Content-Type': mimeTypes[extname(path)] || 'application/octet-stream' })
    response.end(await readFile(path))
  } catch {
    response.writeHead(404)
    response.end()
  }
})
server.listen(0, '127.0.0.1')
await once(server, 'listening')
await mkdir(artifactDirectory, { recursive: true })

try {
  for (const engine of ['chrome', 'firefox']) {
    const browser = await puppeteer.launch({
      browser: engine,
      executablePath: engine === 'chrome' ? '/usr/bin/chromium' : '/usr/bin/firefox-esr',
      headless: true,
      args: engine === 'chrome' ? ['--no-sandbox', '--disable-dev-shm-usage'] : [],
      extraPrefsFirefox: engine === 'firefox' ? { 'ui.prefersReducedMotion': 1 } : undefined,
    })
    const report = { browser: await browser.version(), hosts: [], pending: ['Screen reader', 'Native browser zoom'] }
    try {
      for (const [host, path] of [['demo', '/index.html'], ['reuse', '/tests/browser/reuse.html']]) {
        const page = await browser.newPage()
        const errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        page.on('console', (message) => {
          if (['warn', 'error'].includes(message.type())) errors.push(message.text())
        })
        page.on('response', (response) => {
          if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`)
        })
        const root = '.investment-calculator'
        const editor = `${root} .one-time-contributions`
        const add = `${editor} .one-time-contributions__add`
        const row = (number) => `${editor} .contribution-row:nth-child(${number})`
        const amount = (number) => `${row(number)} input[inputmode="decimal"]`
        const year = (number) => `${row(number)} input[inputmode="numeric"]`
        const remove = (number) => `${row(number)} button`
        const text = (selector) => page.$eval(selector, (element) => element.textContent.trim())
        const first = (callback, ...args) => page.$eval(root, callback, ...args)
        const focusIs = async (selector) => assert.equal(await page.$eval(selector, (element) => (
          document.activeElement === element
        )), true, `Focus: ${selector}`)
        const edit = async (selector, draft) => {
          await page.focus(selector)
          await page.keyboard.down('Control')
          await page.keyboard.press('A')
          await page.keyboard.up('Control')
          await page.keyboard.press('Backspace')
          await page.keyboard.type(draft)
        }
        const assertValid = async (valid) => {
          await page.waitForFunction((valid) => (
            document.querySelector('.investment-calculator').querySelectorAll('dd').length === (valid ? 3 : 0)
          ), {}, valid)
        }
        await page.goto(`http://127.0.0.1:${server.address().port}${path}`)
        await assertValid(true)
        const untouchedSecond = host === 'reuse'
          ? await page.$eval('[data-test="second"]', (element) => element.outerHTML) : null
        await page.focus(add)
        await page.keyboard.press('Enter')
        await page.waitForSelector(amount(1))
        await focusIs(amount(1))
        await assertValid(false)
        assert.equal(await page.$eval(year(1), (input) => input.value), '1')
        await edit(amount(1), '1000,50')
        await assertValid(true)
        await page.keyboard.press('Enter')
        await page.keyboard.press('Tab')
        await focusIs(year(1))
        await edit(year(1), '10')
        await page.keyboard.press('Tab')
        await focusIs(remove(1))
        assert.equal(await page.$eval(remove(1), (element) => getComputedStyle(element).outlineWidth), '3px')
        await page.keyboard.press('Tab')
        await focusIs(add)
        if (host === 'reuse') {
          const payload = JSON.parse(await text('[data-test="first-events"]')).at(-1)
          assert.equal(payload.investedCapital, 71000.5)
          assert.ok(Math.abs(payload.finalValue - 107639.5174837243) < 1e-6)
          assert.equal(await text('[data-test="submissions"]'), '0')
        }
        const duration = `${root} input[id$="-durationYears"]`
        await page.focus(duration)
        await page.keyboard.press('ArrowLeft')
        await assertValid(false)
        assert.equal(await page.$eval(year(1), (input) => input.value), '10')
        assert.equal(await page.$eval(year(1), (input) => input.getAttribute('aria-invalid')), 'true')
        await page.keyboard.press('ArrowRight')
        await assertValid(true)

        for (let index = 2; index <= 3; index += 1) {
          await page.focus(add)
          await page.keyboard.press(' ')
          await page.waitForSelector(amount(index))
          await focusIs(amount(index))
          await edit(amount(index), index === 2 ? '1.' : '0')
        }
        await assertValid(false)
        const lastId = await page.$eval(amount(3), (input) => input.id)
        await page.focus(remove(2))
        await page.keyboard.press('Enter')
        await page.waitForFunction((id) => document.activeElement?.id === id, {}, lastId)
        await page.waitForFunction(() => document.querySelectorAll('.investment-calculator:first-of-type .contribution-row').length === 2)
        await assertValid(true)
        assert.equal(await page.$eval(amount(2), (input) => input.id), lastId)
        await page.focus(remove(2))
        await page.keyboard.press('Enter')
        await focusIs(amount(1))
        await page.waitForFunction(() => document.querySelector('.investment-calculator').querySelectorAll('.contribution-row').length === 1)

        await page.focus(add)
        await page.keyboard.press('Enter')
        await edit(amount(2), '1000000000.01')
        await edit(year(2), '11')
        await assertValid(false)
        for (const width of [320, 640, 1280]) {
          await page.setViewport({ width, height: 900 })
          const layout = await first((calculator) => {
            const ids = [...document.querySelectorAll('[id]')].map((element) => element.id)
            return {
              uniqueIds: ids.length === new Set(ids).size,
              associations: [...calculator.querySelectorAll('.contribution-row input')].every((input) => (
                input.labels.length === 1 && input.labels[0].textContent.includes('Contribution')
                && input.getAttribute('aria-describedby').split(' ').every((id) => calculator.contains(document.getElementById(id)))
              )),
              noOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth
                && [...calculator.querySelectorAll('.one-time-contributions, .one-time-contributions *')]
                  .every((element) => element.scrollWidth <= element.clientWidth + 1),
              targets: [...calculator.querySelectorAll('.one-time-contributions input, .one-time-contributions button')]
                .every((element) => element.getBoundingClientRect().height >= 44 && element.getBoundingClientRect().width >= 44),
              disclaimer: calculator.querySelector('aside').checkVisibility(),
            }
          })
          assert.deepEqual(layout, { uniqueIds: true, associations: true, noOverflow: true, targets: true, disclaimer: true })
          await page.screenshot({ path: join(artifactDirectory, `${engine}-${host}-${width}-invalid.png`), fullPage: true })
        }
        await edit(amount(2), '0,01')
        await edit(year(2), '1')
        await assertValid(true)
        await page.screenshot({ path: join(artifactDirectory, `${engine}-${host}-1280-valid.png`), fullPage: true })

        for (const preference of engine === 'chrome' ? ['no-preference', 'reduce'] : ['reduce']) {
          if (engine === 'chrome') await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: preference }])
          assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), preference === 'reduce')
          // Apply the transition class to inspect the authored duration without frame timing races.
          const duration = await page.$eval(row(1), (element) => {
            element.classList.add('contribution-enter-active')
            const duration = getComputedStyle(element).transitionDuration
            element.classList.remove('contribution-enter-active')
            return duration
          })
          assert.equal(duration.split(',').some((value) => parseFloat(value) > 0), preference === 'no-preference')
        }
        await page.focus(remove(1))
        await page.keyboard.press('Enter')
        await page.waitForFunction(() => document.querySelector('.investment-calculator').querySelectorAll('.contribution-row').length === 1)
        await page.focus(remove(1))
        await page.keyboard.press('Enter')
        await focusIs(add)
        await assertValid(true)
        if (host === 'reuse') {
          assert.equal(await page.$eval('[data-test="second"]', (element) => element.outerHTML), untouchedSecond)
          assert.equal(JSON.parse(await text('[data-test="second-events"]')).length, 1)
          assert.equal(await text('[data-test="submissions"]'), '0')
        }
        assert.deepEqual(errors, [])
        report.hosts.push({ host, keyboard: 'pass', focus: 'pass', validation: 'pass', responsive: 'pass', reducedMotion: 'pass' })
        await page.close()
      }
      await writeFile(join(artifactDirectory, `${engine}-report.json`), JSON.stringify(report, null, 2))
      process.stdout.write(`${report.browser}: contribution checks passed for demo and isolated reuse.\n`)
    } finally {
      await browser.close()
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve))
}
