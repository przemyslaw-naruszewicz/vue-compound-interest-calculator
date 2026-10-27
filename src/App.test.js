// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { expect, test } from 'vitest'
import App from './App.vue'

const control = (wrapper, field) => wrapper.get(`input[id$="-${field}"]`)
const totals = (wrapper) => wrapper.findAll('dd').map((total) => total.text())
const pln = (value) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value)

test('shows one calculator with English copy and the reference scenario in PLN', () => {
  const wrapper = mount(App)

  expect(wrapper.findAll('h1')).toHaveLength(1)
  expect(wrapper.get('main h1').text()).toBe('Compound Interest Calculator')
  expect(wrapper.get('header').text()).toContain('Amounts are shown in Polish złoty (PLN)')
  expect(wrapper.findAll('fieldset')).toHaveLength(1)
  expect(wrapper.findAll('input')).toHaveLength(4)
  for (const [field, value] of Object.entries({
    initialInvestment: '10000', monthlyContribution: '500', durationYears: '10', annualReturn: '7',
  })) expect(control(wrapper, field).element.value).toBe(value)
  expect(totals(wrapper)).toEqual([pln(106639.02), pln(70000), pln(36639.02)])
  expect(wrapper.find('.investment-breakdown__track').exists()).toBe(true)
})

test('updates the projection when each parameter is edited without submitting', async () => {
  const wrapper = mount(App)
  let previousFinal = totals(wrapper)[0]

  for (const [field, value, invested] of [
    ['initialInvestment', '11000', 71000],
    ['monthlyContribution', '600', 83000],
    ['durationYears', '11', 90200],
    ['annualReturn', '8', 90200],
  ]) {
    await control(wrapper, field).setValue(value)
    expect(totals(wrapper)[0]).not.toBe(previousFinal)
    expect(totals(wrapper)[1]).toBe(pln(invested))
    previousFinal = totals(wrapper)[0]
  }
  expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
})

test('hides stale results for invalid drafts and recovers while preserving other edits', async () => {
  const wrapper = mount(App)
  await control(wrapper, 'monthlyContribution').setValue('750,50')
  await control(wrapper, 'durationYears').setValue('15')
  await control(wrapper, 'annualReturn').setValue('5.5')
  const before = totals(wrapper)

  for (const draft of ['', '1.', '-1', '1000000000.01']) {
    await control(wrapper, 'initialInvestment').setValue(draft)
    expect(control(wrapper, 'initialInvestment').element.value).toBe(draft)
    expect(control(wrapper, 'initialInvestment').attributes('aria-invalid')).toBe('true')
    expect(wrapper.text()).toContain('Results unavailable')
    expect(totals(wrapper)).toEqual([])
    expect(wrapper.find('.investment-breakdown').exists()).toBe(false)
  }

  await control(wrapper, 'initialInvestment').setValue('10000')
  expect(totals(wrapper)).toEqual(before)
  expect(control(wrapper, 'initialInvestment').attributes('aria-invalid')).toBe('false')
  expect(control(wrapper, 'monthlyContribution').element.value).toBe('750,50')
  expect(control(wrapper, 'durationYears').element.value).toBe('15')
  expect(control(wrapper, 'annualReturn').element.value).toBe('5.5')
  expect(wrapper.find('.investment-breakdown__track').exists()).toBe(true)
})

test('shows a neutral breakdown when both amounts are zero', async () => {
  const wrapper = mount(App)
  await control(wrapper, 'initialInvestment').setValue('0')
  await control(wrapper, 'monthlyContribution').setValue('0')

  expect(totals(wrapper)).toEqual([pln(0), pln(0), pln(0)])
  expect(wrapper.text()).toContain('No invested capital or gain yet.')
  expect(wrapper.get('.investment-breakdown__legend').text()).toContain('Total invested: 0.0%')
  expect(wrapper.get('.investment-breakdown__legend').text()).toContain('Projected gain: 0.0%')
})

test('shows zero gain with positive capital at zero return', async () => {
  const wrapper = mount(App)
  await control(wrapper, 'annualReturn').setValue('0')

  expect(totals(wrapper)).toEqual([pln(70000), pln(70000), pln(0)])
  expect(wrapper.get('.investment-breakdown__legend').text()).toContain('Total invested: 100.0%')
  expect(wrapper.get('.investment-breakdown__legend').text()).toContain('Projected gain: 0.0%')
  expect(wrapper.find('.investment-breakdown__empty').exists()).toBe(false)
})
