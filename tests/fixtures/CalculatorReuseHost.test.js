// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { createApp, nextTick } from 'vue'
import { expect, test } from 'vitest'
import { InvestmentCalculator } from '../../src/index.js'
import CalculatorReuseHost from './CalculatorReuseHost.vue'

const control = (wrapper, field) => wrapper.get(`input[id$="-${field}"]`)
const events = (wrapper, instance) => JSON.parse(wrapper.get(`[data-test="${instance}-events"]`).text())

function checkAssociations(wrapper) {
  const ids = wrapper.findAll('[id]').map((node) => node.attributes('id'))
  expect(new Set(ids).size).toBe(ids.length)
  for (const calculator of wrapper.findAllComponents(InvestmentCalculator)) {
    for (const input of calculator.findAll('input')) {
      expect(calculator.get(`label[for="${input.attributes('id')}"]`).exists()).toBe(true)
      const descriptions = input.attributes('aria-describedby').split(' ')
      expect(descriptions).toHaveLength(input.attributes('aria-invalid') === 'true' ? 2 : 1)
      for (const id of descriptions) expect(calculator.get(`[id="${id}"]`).text()).not.toBe('')
    }
    expect(calculator.get(`[id="${calculator.get('section').attributes('aria-labelledby')}"]`).text())
      .toBe('Investment projection')
  }
}

test('keeps drafts, results, errors and parent events independent through edits and recovery', async () => {
  const wrapper = mount(CalculatorReuseHost)
  const [first, second] = wrapper.findAllComponents(InvestmentCalculator)
  await nextTick()
  expect(events(wrapper, 'first')).toHaveLength(1)
  expect(events(wrapper, 'second')).toHaveLength(1)
  expect(events(wrapper, 'first')[0]).not.toEqual(events(wrapper, 'second')[0])
  const secondHtml = second.html()
  const secondEvents = events(wrapper, 'second')
  const unchangedSecond = () => {
    expect(second.html()).toBe(secondHtml)
    expect(events(wrapper, 'second')).toEqual(secondEvents)
  }

  for (const [field, value] of [
    ['initialInvestment', '2000,50'], ['monthlyContribution', '100.25'],
    ['durationYears', '5'], ['annualReturn', '8.1'],
  ]) {
    const before = events(wrapper, 'first').at(-1)
    await control(first, field).setValue(value)
    expect(events(wrapper, 'first').at(-1)).not.toEqual(before)
    expect(control(first, field).element.value).toBe(value)
    unchangedSecond()
  }
  const validEvents = events(wrapper, 'first')
  const totals = first.findAll('dd').map((node) => node.text())
  for (const draft of ['1.', '', '1000000000.01']) {
    await control(first, 'initialInvestment').setValue(draft)
    expect(events(wrapper, 'first')).toEqual([...validEvents, null])
    expect(control(first, 'initialInvestment').attributes('aria-invalid')).toBe('true')
    expect(first.find('dd').exists()).toBe(false)
    expect(first.get('.investment-calculator__status').text()).toContain('Projection unavailable')
    checkAssociations(wrapper)
    unchangedSecond()
  }
  await control(first, 'initialInvestment').setValue('2000,50')
  expect(events(wrapper, 'first')).toEqual([...validEvents, null, validEvents.at(-1)])
  expect(first.findAll('dd').map((node) => node.text())).toEqual(totals)
  expect(control(first, 'monthlyContribution').element.value).toBe('100.25')
  expect(first.find('[aria-invalid="true"]').exists()).toBe(false)
  checkAssociations(wrapper)
  unchangedSecond()

  const firstHtml = first.html()
  const firstEvents = events(wrapper, 'first')
  await control(second, 'monthlyContribution').setValue('')
  expect(events(wrapper, 'second')).toEqual([...secondEvents, null])
  expect(first.html()).toBe(firstHtml)
  expect(events(wrapper, 'first')).toEqual(firstEvents)
  await control(first, 'initialInvestment').setValue('')
  checkAssociations(wrapper)
})

test('keeps reactive formatting and ignored defaults local without changing financial events', async () => {
  const wrapper = mount(CalculatorReuseHost)
  const [first, second] = wrapper.findAllComponents(InvestmentCalculator)
  await control(first, 'initialInvestment').setValue('123,45')
  const before = events(wrapper, 'first')
  const secondHtml = second.html()
  const secondEvents = events(wrapper, 'second')
  for (const [locale, currency, effectiveLocale, effectiveCurrency] of [
    ['en-US', 'USD', 'en-US', 'USD'], ['bad_locale', 'USD', 'pl-PL', 'USD'],
    ['en-US', 'bad', 'en-US', 'PLN'],
  ]) {
    await wrapper.get('[data-test="first-locale"]').setValue(locale)
    await wrapper.get('[data-test="first-currency"]').setValue(currency)
    expect(first.get('dd').text()).toBe(new Intl.NumberFormat(effectiveLocale, {
      style: 'currency', currency: effectiveCurrency,
    }).format(before.at(-1).finalValue))
    expect(first.get('label').text()).toContain(`(${effectiveCurrency})`)
    expect(control(first, 'initialInvestment').element.value).toBe('123,45')
    expect(events(wrapper, 'first')).toEqual(before)
    expect(second.html()).toBe(secondHtml)
    expect(events(wrapper, 'second')).toEqual(secondEvents)
  }
  const firstHtml = first.html()
  await wrapper.get('[data-test="change-defaults"]').trigger('click')
  expect(first.html()).toBe(firstHtml)
  expect(events(wrapper, 'first')).toEqual(before)
  expect(second.html()).toBe(secondHtml)
  expect(events(wrapper, 'second')).toEqual(secondEvents)
})

test('uses distinct host-configured ID prefixes across separate Vue app roots', async () => {
  const roots = ['savings-a', 'savings-b'].map((prefix) => {
    const container = document.createElement('div')
    document.body.append(container)
    const app = createApp(InvestmentCalculator)
    app.config.idPrefix = prefix
    app.mount(container)
    return { app, container }
  })
  try {
    await nextTick()
    const ids = roots.flatMap(({ container }) => [...container.querySelectorAll('[id]')].map((node) => node.id))
    expect(new Set(ids).size).toBe(ids.length)
    for (const [index, { container }] of roots.entries()) {
      for (const node of container.querySelectorAll('[id]')) {
        expect(node.id.startsWith(index === 0 ? 'savings-a-' : 'savings-b-')).toBe(true)
      }
    }
  } finally {
    for (const { app, container } of roots) {
      app.unmount()
      container.remove()
    }
  }
})
