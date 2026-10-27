// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { expect, test } from 'vitest'
import InvestmentResultsHost from './InvestmentResultsHost.vue'
import InvestmentSummary from '../../src/features/investment-calculator/components/InvestmentSummary.vue'
import { calculateInvestment } from '../../src/features/investment-calculator/domain/calculateInvestment.js'
import { DEFAULT_INVESTMENT_PARAMETERS } from '../../src/features/investment-calculator/domain/investmentConstraints.js'

test('formatting changes preserve two-decimal drafts and unrounded results, including JPY', async () => {
  const wrapper = mount(InvestmentResultsHost)
  const initial = wrapper.get('input[id$="-initialInvestment"]')
  const monthly = wrapper.get('input[id$="-monthlyContribution"]')
  await initial.setValue('1234,56')
  await monthly.setValue('78.91')
  const summary = wrapper.getComponent(InvestmentSummary)
  const result = summary.props('result')
  const snapshot = { ...result }
  for (const [locale, currency, effectiveCurrency] of [
    ['ja-JP', 'JPY', 'JPY'], ['en-US', 'USD', 'USD'],
    ['bad_locale', 'USD', 'USD'], ['en-US', 'bad', 'PLN'],
  ]) {
    await wrapper.setProps({ locale, currency })
    expect(initial.element.value).toBe('1234,56')
    expect(monthly.element.value).toBe('78.91')
    expect(wrapper.get('label').text()).toBe(`Initial investment (${effectiveCurrency})`)
    expect(summary.props('result')).toBe(result)
    expect(result).toEqual(snapshot)
  }
  await wrapper.setProps({ locale: 'ja-JP', currency: 'JPY' })
  await monthly.setValue('78.92')
  const nextResult = summary.props('result')
  expect(nextResult).toEqual(calculateInvestment({
    ...DEFAULT_INVESTMENT_PARAMETERS, initialInvestment: 1234.56, monthlyContribution: 78.92,
  }))
  expect(nextResult.investedCapital).not.toBe(Math.round(nextResult.investedCapital))
  expect(wrapper.get('dd').text()).toBe(
    new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(nextResult.finalValue),
  )
})

test('invalid edits remove totals and the bar, then recover without resetting other inputs', async () => {
  const wrapper = mount(InvestmentResultsHost)
  const input = wrapper.get('input[id$="-initialInvestment"]')
  await input.setValue('1.')
  expect(input.element.value).toBe('1.')
  expect(wrapper.get('input[id$="-monthlyContribution"]').element.value).toBe('500')
  expect(wrapper.find('dd').exists()).toBe(false)
  expect(wrapper.find('.investment-breakdown').exists()).toBe(false)
  expect(wrapper.text()).toContain('Correct the investment parameters')
  await input.setValue('1.50')
  expect(wrapper.findAll('dd')).toHaveLength(3)
  expect(wrapper.find('.investment-breakdown').exists()).toBe(true)
  expect(wrapper.getComponent(InvestmentSummary).props('result').investedCapital).toBe(60001.5)
})
