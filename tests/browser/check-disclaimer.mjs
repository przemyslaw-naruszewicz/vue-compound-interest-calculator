import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdir, readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { extname, join, resolve } from 'node:path'
import process from 'node:process'

const puppeteer = createRequire(import.meta.url)('puppeteer')
const buildDirectory = resolve(process.argv[2] || '/tmp/calculator-disclaimer-browser')
const artifactDirectory = process.env.DISCLAIMER_ARTIFACT_DIR || '/tmp/calculator-disclaimer-artifacts'
const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }
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

try {
  for (const engine of ['chrome', 'firefox']) {
    const browser = await puppeteer.launch({
      browser: engine,
      executablePath: engine === 'chrome' ? '/usr/bin/chromium' : '/usr/bin/firefox-esr',
      headless: true,
      args: engine === 'chrome' ? ['--no-sandbox', '--disable-dev-shm-usage'] : [],
    })
    try {
      const demoStyles = new Map()
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
        await page.goto(`http://127.0.0.1:${server.address().port}${path}`)
        await page.waitForSelector('.investment-calculator dd')
        for (const width of [320, 640, 1280]) {
          await page.setViewport({ width, height: 900 })
          for (const state of ['valid', 'invalid', 'zero']) {
            await page.$eval('.investment-calculator', (calculator, state) => {
              for (const [field, value] of [
                ['initialInvestment', state === 'invalid' ? '' : state === 'zero' ? '0' : '10000'],
                ['monthlyContribution', state === 'zero' ? '0' : '500'],
              ]) {
                const input = calculator.querySelector(`input[id$="-${field}"]`)
                input.value = value
                input.dispatchEvent(new Event('input', { bubbles: true }))
              }
            }, state)
            const notices = await page.$$eval('.investment-calculator__disclaimer', (elements) => {
              const luminance = (color) => color.match(/[\d.]+/g).slice(0, 3).map((channel) => {
                const value = Number(channel) / 255
                return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
              }).reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0)
              return elements.map((element) => {
                const heading = element.querySelector('h2')
                const paragraph = element.querySelector('p')
                const style = getComputedStyle(element)
                const background = luminance(style.backgroundColor)
                return {
                  visible: element.checkVisibility() && !element.closest('details, dialog, [hidden]'),
                  heading: heading.textContent.trim(),
                  labelled: element.getAttribute('aria-labelledby') === heading.id,
                  text: paragraph.textContent.replace(/\s+/g, ' ').trim(),
                  beforeResults: element.nextElementSibling.classList.contains('investment-summary'),
                  readable: [heading, paragraph].every((node) => {
                    const textStyle = getComputedStyle(node)
                    const foreground = luminance(textStyle.color)
                    const ratio = (Math.max(background, foreground) + 0.05)
                      / (Math.min(background, foreground) + 0.05)
                    return ratio >= 4.5 && parseFloat(textStyle.fontSize) >= 16
                      && node.scrollWidth <= node.clientWidth + 1
                  }),
                  styles: [style.backgroundColor, style.color, style.fontSize, style.padding,
                    style.borderInlineStartWidth, getComputedStyle(heading).fontWeight],
                }
              })
            })
            assert.equal(notices.length, host === 'demo' ? 1 : 2)
            for (const notice of notices) {
              assert.equal(notice.visible, true)
              assert.equal(notice.heading, 'Not investment advice')
              assert.equal(notice.labelled, true)
              assert.equal(notice.text, 'This calculator is for illustrative purposes only and does not constitute investment advice. Results are not guaranteed.')
              assert.equal(notice.beforeResults, true)
              assert.equal(notice.readable, true, `${engine} ${host} ${width} ${state}: readability`)
              if (host === 'demo') demoStyles.set(width, notice.styles)
              else assert.deepEqual(notice.styles, demoStyles.get(width), 'Styles independent of demo CSS')
            }
            const layout = await page.evaluate(() => ({
              width: document.documentElement.clientWidth,
              contentWidth: document.documentElement.scrollWidth,
              overflowing: [...document.querySelectorAll('body, #app, main, .investment-calculator, aside')]
                .filter((element) => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
                .map((element) => element.tagName),
            }))
            assert.ok(layout.contentWidth <= layout.width,
              `${engine} ${host} ${width} ${state}: overflow ${JSON.stringify(layout)}`)
            const totals = await page.$eval('.investment-calculator', (element) => element.querySelectorAll('dd').length)
            assert.equal(totals, state === 'invalid' ? 0 : 3)
            await (await page.$('.investment-calculator__disclaimer')).screenshot({
              path: join(artifactDirectory, `${engine}-${host}-${width}-${state}-notice.png`),
            })
            if (state === 'valid') await page.screenshot({
              path: join(artifactDirectory, `${engine}-${host}-${width}.png`), fullPage: true,
            })
          }
        }
        assert.deepEqual(errors, [])
        await page.close()
      }
      process.stdout.write(`${await browser.version()}: disclaimer visibility, labels, contrast, responsive layout and isolated reuse passed in valid, invalid and zero states.\n`)
    } finally {
      await browser.close()
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve))
}
