// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { expect, test } from 'vitest'
import InvestmentSummary from './InvestmentSummary.vue'
import { calculateInvestment } from '../domain/calculateInvestment.js'
import { DEFAULT_INVESTMENT_PARAMETERS } from '../domain/investmentConstraints.js'

const defaultResult = Object.freeze(calculateInvestment(DEFAULT_INVESTMENT_PARAMETERS))
const intlFormat = (locale, currency, value) => (
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value)
)

function totals(wrapper) {
  return wrapper.findAll('dd').map((value) => value.text())
}

function expectedTotals(result, locale, currency) {
  return [result.finalValue, result.investedCapital, result.investmentGain]
    .map((value) => intlFormat(locale, currency, value))
}

test('labels the reference totals and emphasizes the final value', () => {
  const wrapper = mount(InvestmentSummary, { props: { result: defaultResult } })
  expect(defaultResult.finalValue).toBeCloseTo(106639.02, 2)
  expect(defaultResult.investedCapital).toBe(70000)
  expect(defaultResult.investmentGain).toBeCloseTo(36639.02, 2)
  expect(wrapper.findAll('dt').map((label) => label.text())).toEqual([
    'Projected final value', 'Total invested', 'Projected gain',
  ])
  expect(totals(wrapper)).toEqual(expectedTotals(defaultResult, 'pl-PL', 'PLN'))
  expect(wrapper.get('.investment-summary__metric--final dt').text()).toBe('Projected final value')
  expect(wrapper.get('section').attributes('aria-labelledby')).toBe(wrapper.get('h2').attributes('id'))
  expect(wrapper.find('h1').exists()).toBe(false)
  expect(wrapper.find('[role="status"]').exists()).toBe(false)
})

test.each([['en-US', 'USD'], ['ja-JP', 'JPY']])(
  'renders custom results using %s / %s without changing numerical results', async (locale, currency) => {
    const result = Object.freeze(calculateInvestment({
      initialInvestment: 1234.56, monthlyContribution: 78.91, durationYears: 3, annualReturn: 5.3,
    }))
    const original = { ...result }
    const wrapper = mount(InvestmentSummary, { props: { result } })
    const previousWidths = wrapper.findAll('.investment-breakdown__track > span')
      .map((segment) => segment.attributes('style'))
    await wrapper.setProps({ locale, currency })
    expect(totals(wrapper)).toEqual(expectedTotals(result, locale, currency))
    expect(wrapper.findAll('.investment-breakdown__track > span')
      .map((segment) => segment.attributes('style'))).toEqual(previousWidths)
    expect(result).toEqual(original)
    expect(wrapper.emitted()).toEqual({})
  },
)

test.each([
  ['bad_locale', 'USD', 'pl-PL', 'USD', ['pl-PL']],
  ['en-US', 'usd', 'en-US', 'PLN', ['PLN']],
  ['bad_locale', 'bad', 'pl-PL', 'PLN', ['pl-PL', 'PLN']],
  ['zz-ZZ', 'JPY', 'pl-PL', 'JPY', ['pl-PL']],
])('visibly reports fallbacks for %s / %s', async (locale, currency, effectiveLocale, effectiveCurrency, names) => {
  const wrapper = mount(InvestmentSummary, { props: { result: defaultResult, locale, currency } })
  const notice = wrapper.get('[role="status"]').text()
  for (const name of names) expect(notice).toContain(`Using ${name}`)
  expect(totals(wrapper)).toEqual(expectedTotals(defaultResult, effectiveLocale, effectiveCurrency))
  await wrapper.setProps({ locale: 'en-US', currency: 'USD' })
  expect(wrapper.find('[role="status"]').exists()).toBe(false)
  expect(totals(wrapper)).toEqual(expectedTotals(defaultResult, 'en-US', 'USD'))
})

test('removes old totals and the bar when unavailable and recovers to the current result', async () => {
  const wrapper = mount(InvestmentSummary, { props: { result: defaultResult } })
  await wrapper.setProps({ result: null })
  expect(totals(wrapper)).toEqual([])
  expect(wrapper.find('.investment-breakdown').exists()).toBe(false)
  expect(wrapper.text()).toContain('Results unavailable. Correct the investment parameters')
  await wrapper.setProps({ locale: 'ja-JP', currency: 'JPY' })
  expect(totals(wrapper)).toEqual([])
  const result = calculateInvestment({ ...DEFAULT_INVESTMENT_PARAMETERS, initialInvestment: 123.45 })
  await wrapper.setProps({ result })
  expect(totals(wrapper)).toEqual(expectedTotals(result, 'ja-JP', 'JPY'))
  expect(wrapper.find('.investment-summary__unavailable').exists()).toBe(false)
  expect(wrapper.find('.investment-breakdown').exists()).toBe(true)
})

test('reports formatting fallbacks even while results are unavailable', () => {
  const wrapper = mount(InvestmentSummary, {
    props: { result: null, locale: 'bad_locale', currency: 'bad' },
  })
  expect(wrapper.get('[role="status"]').text()).toContain('Using pl-PL')
  expect(wrapper.get('[role="status"]').text()).toContain('Using PLN')
  expect(wrapper.text()).toContain('Results unavailable.')
})

test.each([0, -0])('formats zero results (%s) with a neutral breakdown and no negative zero', (zero) => {
  const result = { investedCapital: zero, finalValue: zero, investmentGain: zero }
  const wrapper = mount(InvestmentSummary, { props: { result } })
  expect(totals(wrapper)).toEqual(Array(3).fill(intlFormat('pl-PL', 'PLN', 0)))
  expect(wrapper.text()).toContain('No invested capital or gain yet.')
  expect(wrapper.text()).not.toMatch(/NaN|Infinity|-0/)
})

test('keeps independent monetary rounding separate from unrounded proportions', () => {
  const result = Object.freeze({ finalValue: 0.01, investedCapital: 0.005, investmentGain: 0.005 })
  const wrapper = mount(InvestmentSummary, { props: { result, locale: 'en-US', currency: 'USD' } })
  expect(totals(wrapper)).toEqual(['$0.01', '$0.01', '$0.01'])
  expect(wrapper.findAll('.investment-breakdown__track > span')
    .map((segment) => segment.element.style.width)).toEqual(['50%', '50%'])
  expect(result.investedCapital).toBe(0.005)
})

test('renders the maximum model magnitude with finite totals', () => {
  const result = calculateInvestment({
    initialInvestment: 1_000_000_000, monthlyContribution: 1_000_000_000,
    durationYears: 40, annualReturn: 15,
  })
  const wrapper = mount(InvestmentSummary, { props: { result } })
  expect(totals(wrapper)).toEqual(expectedTotals(result, 'pl-PL', 'PLN'))
  expect(wrapper.text()).not.toMatch(/NaN|Infinity|-0/)
})

test.each([NaN, Infinity, -Infinity])('treats a non-finite total (%s) as unavailable', (finalValue) => {
  const wrapper = mount(InvestmentSummary, { props: { result: { ...defaultResult, finalValue } } })
  expect(totals(wrapper)).toEqual([])
  expect(wrapper.find('.investment-breakdown').exists()).toBe(false)
  expect(wrapper.text()).toContain('Results unavailable.')
  expect(wrapper.text()).not.toMatch(/NaN|Infinity/)
})

test('uses distinct accessible heading IDs for two summaries', () => {
  const wrapper = mount({
    components: { InvestmentSummary },
    setup: () => ({ result: defaultResult }),
    template: '<div><InvestmentSummary :result="result" /><InvestmentSummary :result="result" /></div>',
  })
  const ids = wrapper.findAll('h2').map((heading) => heading.attributes('id'))
  expect(new Set(ids).size).toBe(2)
  expect(wrapper.findAll('section').map((section) => section.attributes('aria-labelledby'))).toEqual(ids)
})
