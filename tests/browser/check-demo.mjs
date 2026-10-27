import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import process from 'node:process'

const puppeteer = createRequire(import.meta.url)('puppeteer')
const targets = process.argv.slice(2)
if (!targets.length) targets.push('http://127.0.0.1:5173')
const artifactDirectory = process.env.DEMO_ARTIFACT_DIR || '/tmp/demo-artifacts'
const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

try {
  await mkdir(artifactDirectory, { recursive: true })
  for (const target of targets) {
    const page = await browser.newPage()
    const errors = []
    const externalRequests = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (['error', 'warn'].includes(message.type())) errors.push(message.text())
    })
    page.on('request', (request) => {
      if (new URL(request.url()).origin !== new URL(target).origin) externalRequests.push(request.url())
    })
    const input = (field) => `input[id$="-${field}"]`
    const text = (selector) => page.$eval(selector, (element) => element.textContent.trim())
    const values = () => page.$$eval('dd', (elements) => elements.map((element) => element.textContent.trim()))
    const pln = (value) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value)
    const edit = async (field, value) => {
      await page.focus(input(field))
      await page.$eval(input(field), (element, value) => {
        element.value = value
        element.dispatchEvent(new Event('input', { bubbles: true }))
      }, value)
    }
    const checkLayout = async (label) => {
      assert.equal(await page.evaluate(() => (
        document.documentElement.scrollWidth <= document.documentElement.clientWidth
        && [...document.querySelectorAll('main, header, fieldset, input, dd, .investment-summary')]
          .every((element) => element.scrollWidth <= element.clientWidth + 1)
      )), true, `Overflow: ${target}, ${label}`)
      assert.equal(await page.$$eval('input', (elements) => elements.every((element) => {
        const bounds = element.getBoundingClientRect()
        return bounds.width > 0 && bounds.height >= 44
          && bounds.left >= 0 && bounds.right <= window.innerWidth
      })), true, `Inaccessible control: ${target}, ${label}`)
      for (const selector of ['input', 'dd']) {
        for (const element of await page.$$(selector)) {
          await element.evaluate((node) => node.scrollIntoView({ block: 'center' }))
          assert.equal(await element.isIntersectingViewport(), true, `${selector}: ${label}`)
        }
      }
    }
    const screenshot = (label) => page.screenshot({
      path: join(artifactDirectory, `demo-${new URL(target).port || 'default'}-${label}.png`),
      fullPage: true,
    })

    await page.setViewport({ width: 1280, height: 900 })
    await page.goto(target)
    await page.waitForSelector('dd')
    assert.equal(await page.title(), 'Compound Interest Calculator')
    assert.equal(await page.$eval('html', (element) => element.lang), 'en')
    assert.equal(await page.$$eval('h1', (elements) => elements.length), 1)
    assert.equal(await text('h1'), 'Compound Interest Calculator')
    assert.equal(await page.$$eval('fieldset', (elements) => elements.length), 1)
    assert.deepEqual(await values(), [pln(106639.02), pln(70000), pln(36639.02)])
    await checkLayout('desktop defaults')
    await screenshot('desktop')
    await page.setViewport({ width: 320, height: 900 })
    await checkLayout('320px defaults')
    await screenshot('320')

    // Enter text using the keyboard to exercise focus and reactive input handling.
    await page.focus(input('monthlyContribution'))
    await page.keyboard.press('Home')
    await page.keyboard.down('Shift')
    await page.keyboard.press('End')
    await page.keyboard.up('Shift')
    await page.keyboard.type('750,50')
    assert.equal((await values())[1], pln(100060))
    for (const field of ['durationYears', 'annualReturn']) {
      const previous = await values()
      await page.focus(input(field))
      await page.keyboard.press('ArrowRight')
      assert.notDeepEqual(await values(), previous)
    }
    await page.focus(input('initialInvestment'))
    await page.keyboard.press('Tab')
    assert.equal(await page.$eval(input('monthlyContribution'), (element) => (
      document.activeElement === element && getComputedStyle(element).outlineStyle === 'solid'
    )), true)

    const beforeInvalid = await values()
    for (const draft of ['', '1.', '-1', '1000000000.01']) {
      await edit('initialInvestment', draft)
      assert.deepEqual(await values(), [])
      assert.equal(await page.$('.investment-breakdown'), null)
      assert.equal(await page.$eval(input('initialInvestment'), (element) => (
        document.activeElement === element && element.getAttribute('aria-invalid') === 'true'
      )), true)
      assert.match(await text('.investment-calculator__status'), /Projection unavailable/)
      await checkLayout(`invalid draft ${draft}`)
    }
    await screenshot('invalid-320')
    await edit('initialInvestment', '10000')
    assert.deepEqual(await values(), beforeInvalid)
    assert.equal(await page.$eval(input('monthlyContribution'), (element) => element.value), '750,50')
    assert.equal(await text('.investment-calculator__status'), 'Projection available.')

    await edit('initialInvestment', '0')
    await edit('monthlyContribution', '0')
    assert.deepEqual(await values(), [pln(0), pln(0), pln(0)])
    assert.equal(await text('.investment-breakdown__empty'), 'No invested capital or gain yet.')
    assert.equal(await page.$$eval('.investment-breakdown__track > span', (elements) => (
      elements.every((element) => element.getBoundingClientRect().width === 0)
    )), true)
    await edit('initialInvestment', '10000')
    await page.focus(input('annualReturn'))
    await page.keyboard.press('Home')
    assert.deepEqual(await values(), [pln(10000), pln(10000), pln(0)])
    assert.match(await text('.investment-breakdown__legend'), /Projected gain: 0.0%/)

    await edit('initialInvestment', '1000000000')
    await edit('monthlyContribution', '1000000000')
    for (const field of ['durationYears', 'annualReturn']) {
      await page.focus(input(field))
      await page.keyboard.press('End')
    }
    assert.equal((await values())[1], pln(481000000000))
    assert.equal((await values()).length, 3)
    for (const width of [320, 640, 1280]) {
      await page.setViewport({ width, height: 900 })
      await checkLayout(`${width}px maximum values`)
      await screenshot(`maximum-${width}`)
    }
    // CSS zoom exercises doubled content size and scrolling in headless Chromium.
    await page.$eval('#app', (element) => { element.style.zoom = '2' })
    for (const width of [640, 1280]) {
      await page.setViewport({ width, height: 900 })
      await checkLayout(`${width}px maximum values at 200% CSS zoom`)
      await page.focus(input('durationYears'))
      await page.keyboard.press('ArrowLeft')
      assert.equal(await page.$eval(input('durationYears'), (element) => document.activeElement === element), true)
      await screenshot(`zoom-200-${width}`)
    }
    assert.deepEqual(externalRequests, [])
    assert.deepEqual(errors, [])
    process.stdout.write(`${target}: reference totals, edits, keyboard/focus, validation/recovery, zero states, maximum values, responsive layout, 200% CSS zoom and clean console passed.\n`)
    await page.close()
  }
  process.stdout.write(`Browser: ${await browser.version()}\n`)
} finally {
  await browser.close()
}
