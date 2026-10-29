import { expect, test } from 'vitest'
import { useInvestmentCalculator } from './useInvestmentCalculator.js'

test('owns stable row identities and preserves drafts/errors when another row is removed', () => {
  const calculator = useInvestmentCalculator()
  const first = calculator.addContribution()
  const second = calculator.addContribution()
  calculator.updateContribution(first, 'amountDraft', '100,50')
  calculator.updateContribution(second, 'amountDraft', '1.')
  calculator.updateContribution(second, 'yearDraft', '11')
  expect(calculator.result.value).toBeNull()
  calculator.removeContribution(first)
  expect(calculator.contributions.value).toEqual([{
    id: second, amountDraft: '1.', yearDraft: '11',
    errors: { amount: 'invalid_format', year: 'out_of_range' },
  }])
  expect(calculator.addContribution()).toBeGreaterThan(second)
  expect(calculator.contributions.value[0].id).toBe(second)
})

test('duration changes preserve years and restore validity without clamping', () => {
  const calculator = useInvestmentCalculator()
  const id = calculator.addContribution()
  expect(calculator.contributions.value[0]).toMatchObject({ amountDraft: '', yearDraft: '1' })
  expect(calculator.result.value).toBeNull()
  calculator.updateContribution(id, 'amountDraft', ' 1000,50 ')
  calculator.updateContribution(id, 'yearDraft', '10')
  const original = calculator.result.value
  expect(calculator.parameters.value.oneTimeContributions).toEqual([{ year: 10, amount: 1000.5 }])
  calculator.durationYears.value = 9
  expect(calculator.contributions.value[0]).toMatchObject({
    amountDraft: ' 1000,50 ', yearDraft: '10', errors: { year: 'out_of_range' },
  })
  expect(calculator.result.value).toBeNull()
  calculator.durationYears.value = 10
  expect(calculator.result.value).toEqual(original)
})

test.each([
  ['amountDraft', '', 'required'], ['amountDraft', '1.', 'invalid_format'],
  ['amountDraft', '1,000.00', 'invalid_format'], ['amountDraft', '1.001', 'invalid_format'],
  ['amountDraft', '1000000000.01', 'out_of_range'],
  ['yearDraft', '', 'required'], ['yearDraft', '1.5', 'invalid_format'],
  ['yearDraft', '1e1', 'invalid_format'], ['yearDraft', '-1', 'invalid_format'],
  ['yearDraft', '0', 'out_of_range'], ['yearDraft', '11', 'out_of_range'],
])('preserves invalid %s %j and recovers when removed', (field, draft, error) => {
  const calculator = useInvestmentCalculator()
  const original = calculator.result.value
  const id = calculator.addContribution()
  calculator.updateContribution(id, 'amountDraft', '100')
  calculator.updateContribution(id, field, draft)
  expect(calculator.contributions.value[0][field]).toBe(draft)
  expect(calculator.contributions.value[0].errors[field === 'amountDraft' ? 'amount' : 'year']).toBe(error)
  expect(calculator.result.value).toBeNull()
  calculator.removeContribution(id)
  expect(calculator.result.value).toEqual(original)
})

test('separate invocations own independent contribution lists and numeric contracts exclude IDs', () => {
  const first = useInvestmentCalculator()
  const second = useInvestmentCalculator()
  const id = first.addContribution()
  first.updateContribution(id, 'amountDraft', '0,00')
  expect(first.parameters.value.oneTimeContributions).toEqual([{ year: 1, amount: 0 }])
  expect(second.contributions.value).toEqual([])
  expect(second.isValid.value).toBe(true)
  second.addContribution()
  expect(second.isValid.value).toBe(false)
  expect(first.isValid.value).toBe(true)
})
