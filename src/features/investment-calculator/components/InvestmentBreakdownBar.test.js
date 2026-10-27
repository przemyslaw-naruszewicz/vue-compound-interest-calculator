// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { expect, test } from 'vitest'
import InvestmentBreakdownBar from './InvestmentBreakdownBar.vue'
import { calculateInvestment } from '../domain/calculateInvestment.js'
import { DEFAULT_INVESTMENT_PARAMETERS } from '../domain/investmentConstraints.js'

function widths(wrapper) {
  return wrapper.findAll('.investment-breakdown__track > span')
    .map((segment) => Number.parseFloat(segment.element.style.width))
}

function percentages(wrapper) {
  return wrapper.findAll('li strong').map((label) => Number.parseFloat(label.text()))
}

test('uses unrounded result proportions and complementary widths', () => {
  const result = Object.freeze(calculateInvestment(DEFAULT_INVESTMENT_PARAMETERS))
  const wrapper = mount(InvestmentBreakdownBar, { props: { result } })
  const [invested, gain] = widths(wrapper)
  expect(invested).toBeCloseTo(result.investedCapital / result.finalValue * 100, 12)
  expect(gain).toBeCloseTo(100 - invested, 12)
  expect(invested + gain).toBe(100)
  expect(wrapper.get('li').text()).toBe('Total invested: 65.6%')
  expect(wrapper.findAll('li')[1].text()).toBe('Projected gain: 34.4%')
  expect(wrapper.get('.investment-breakdown__track').attributes('aria-hidden')).toBe('true')
  expect(wrapper.get('ul').attributes('aria-label')).toBe('Investment breakdown')
  expect(wrapper.find('[role="progressbar"], progress, meter').exists()).toBe(false)
})

test('derives displayed gain from rounded invested share to avoid a 100.1% total', () => {
  const wrapper = mount(InvestmentBreakdownBar, {
    props: { result: { investedCapital: 125, finalValue: 2000, investmentGain: 1875 } },
  })
  expect(percentages(wrapper)).toEqual([6.3, 93.7])
  expect(widths(wrapper)[0]).toBe(6.25)
  expect(percentages(wrapper).reduce((sum, share) => sum + share, 0)).toBe(100)
})

test('shows 100% invested and 0% gain for positive capital at zero return', () => {
  const result = calculateInvestment({ ...DEFAULT_INVESTMENT_PARAMETERS, annualReturn: 0 })
  const wrapper = mount(InvestmentBreakdownBar, { props: { result } })
  expect(widths(wrapper)).toEqual([100, 0])
  expect(percentages(wrapper)).toEqual([100, 0])
  expect(wrapper.text()).not.toContain('No invested capital')
})

test('shows a neutral track and zero percentages for an empty investment', () => {
  const result = Object.freeze({ investedCapital: 0, finalValue: 0, investmentGain: 0 })
  const wrapper = mount(InvestmentBreakdownBar, { props: { result } })
  expect(widths(wrapper)).toEqual([0, 0])
  expect(percentages(wrapper)).toEqual([0, 0])
  expect(wrapper.text()).toContain('No invested capital or gain yet.')
  expect(wrapper.text()).not.toMatch(/NaN|Infinity|-0/)
})

test.each([
  [0, 100], [100, 100], [100.00000000000001, 100], [-1, 100],
  [Number.MAX_VALUE, 1], [1, Number.MIN_VALUE],
  [1, Number.MAX_VALUE],
])('bounds finite complementary widths for invested %s / final %s', (investedCapital, finalValue) => {
  const wrapper = mount(InvestmentBreakdownBar, {
    props: { result: { investedCapital, finalValue, investmentGain: 0 } },
  })
  for (const width of widths(wrapper)) {
    expect(Number.isFinite(width)).toBe(true)
    expect(width).toBeGreaterThanOrEqual(0)
    expect(width).toBeLessThanOrEqual(100)
  }
  expect(widths(wrapper).reduce((sum, width) => sum + width, 0)).toBe(100)
  expect(wrapper.text()).not.toMatch(/NaN|Infinity|-0/)
})

test('handles the maximum model magnitude without rounding capital first', () => {
  const result = calculateInvestment({
    initialInvestment: 1_000_000_000, monthlyContribution: 1_000_000_000,
    durationYears: 40, annualReturn: 15,
  })
  const wrapper = mount(InvestmentBreakdownBar, { props: { result } })
  expect(widths(wrapper)[0]).toBeCloseTo(result.investedCapital / result.finalValue * 100, 12)
  expect(widths(wrapper).reduce((sum, width) => sum + width, 0)).toBe(100)
})

test.each([
  null, {}, { investedCapital: 1, finalValue: NaN },
  { investedCapital: Infinity, finalValue: 100 }, { investedCapital: 1, finalValue: -1 },
])('hides the bar and legend for unavailable result %j', (result) => {
  const wrapper = mount(InvestmentBreakdownBar, { props: { result } })
  expect(wrapper.find('.investment-breakdown').exists()).toBe(false)
})
