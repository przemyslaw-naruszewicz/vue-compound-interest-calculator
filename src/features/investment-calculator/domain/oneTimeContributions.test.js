import { expect, test } from 'vitest'
import { calculateInvestment } from './calculateInvestment.js'
import { DEFAULT_INVESTMENT_PARAMETERS } from './investmentConstraints.js'
import { validateInvestment } from './validateInvestment.js'

const parameters = {
  initialInvestment: 0, monthlyContribution: 0, durationYears: 2, annualReturn: 12,
}

test('omitted and empty lists preserve the original model', () => {
  expect(calculateInvestment({ ...DEFAULT_INVESTMENT_PARAMETERS, oneTimeContributions: [] }))
    .toEqual(calculateInvestment(DEFAULT_INVESTMENT_PARAMETERS))
})

test('a first-year contribution earns exactly twelve months of interest over two years', () => {
  const result = calculateInvestment({
    ...parameters, oneTimeContributions: [{ year: 1, amount: 1000 }],
  })
  // Independent lump-sum reference: 1000 * 1.01^12.
  expect(result.investedCapital).toBe(1000)
  expect(result.finalValue).toBeCloseTo(1126.825030131970, 9)
  expect(result.investmentGain).toBeCloseTo(126.825030131970, 9)
})

test('final-year contributions earn no interest, after regular contributions and interest', () => {
  const base = { ...parameters, initialInvestment: 1000, monthlyContribution: 100 }
  const without = calculateInvestment(base)
  const withExtra = calculateInvestment({ ...base, oneTimeContributions: [{ year: 2, amount: 1234.56 }] })
  expect(withExtra.finalValue).toBe(without.finalValue + 1234.56)
  expect(withExtra.investedCapital).toBe(without.investedCapital + 1234.56)
  expect(withExtra.investmentGain).toBeCloseTo(without.investmentGain, 9)
  expect(calculateInvestment({ ...parameters, oneTimeContributions: [{ year: 2, amount: 1000 }] }))
    .toEqual({ investedCapital: 1000, finalValue: 1000, investmentGain: 0 })
})

test('sums duplicate years and gives identical results in any row order without mutation', () => {
  const rows = Object.freeze([
    Object.freeze({ year: 1, amount: 1000 }), Object.freeze({ year: 2, amount: 20.5 }),
    Object.freeze({ year: 1, amount: 2000 }), Object.freeze({ year: 1, amount: 0 }),
  ])
  const result = calculateInvestment({ ...parameters, oneTimeContributions: rows })
  expect(result.finalValue).toBeCloseTo(3400.97509039591, 8)
  expect(result.investedCapital).toBe(3020.5)
  expect(calculateInvestment({ ...parameters, oneTimeContributions: [...rows].reverse() })).toEqual(result)
  expect(calculateInvestment({
    ...parameters, oneTimeContributions: [{ year: 1, amount: 3000 }, { year: 2, amount: 20.5 }],
  })).toEqual(result)

  const decimals = [{ year: 1, amount: 1e9 }, { year: 1, amount: 0.01 }, { year: 1, amount: 0.01 }]
  expect(calculateInvestment({ ...parameters, oneTimeContributions: decimals }))
    .toEqual(calculateInvestment({ ...parameters, oneTimeContributions: [...decimals].reverse() }))
})

test.each([0, 0.01, 1234.56, 146048212.02, 1_000_000_000])('accepts amount boundary %s at first/final years', (amount) => {
  const input = {
    ...parameters, durationYears: 40, annualReturn: 0,
    oneTimeContributions: [{ year: 1, amount }, { year: 40, amount }],
  }
  expect(validateInvestment(input)).toEqual({})
  expect(calculateInvestment(input)).toEqual({
    investedCapital: amount * 2, finalValue: amount * 2, investmentGain: 0,
  })
})

test('zero return includes initial capital, monthly deposits and every one-time contribution', () => {
  expect(calculateInvestment({
    ...parameters, initialInvestment: 1000, monthlyContribution: 100, annualReturn: 0,
    oneTimeContributions: [{ year: 1, amount: 20 }, { year: 2, amount: 30 }],
  })).toEqual({ investedCapital: 3450, finalValue: 3450, investmentGain: 0 })
})

test.each([undefined, null, {}, '1000', 1, true])('rejects a malformed supplied list: %s', (oneTimeContributions) => {
  const input = { ...parameters, oneTimeContributions }
  expect(validateInvestment(input)).toEqual({ oneTimeContributions: 'invalid_type' })
  expect(() => calculateInvestment(input)).toThrow(TypeError)
})

test.each([undefined, null, [], 1, '1000', true])('rejects a malformed row: %s', (row) => {
  const input = { ...parameters, oneTimeContributions: [row] }
  expect(validateInvestment(input)).toEqual({ 'oneTimeContributions.0': 'invalid_type' })
  expect(() => calculateInvestment(input)).toThrow(TypeError)
})

test('rejects sparse lists and reports both missing row fields', () => {
  expect(validateInvestment({ ...parameters, oneTimeContributions: Array(1) }))
    .toEqual({ 'oneTimeContributions.0': 'invalid_type' })
  expect(validateInvestment({ ...parameters, oneTimeContributions: [{}] })).toEqual({
    'oneTimeContributions.0.amount': 'required', 'oneTimeContributions.0.year': 'required',
  })
})

test.each([
  ['amount', '1', 'invalid_type', TypeError], ['amount', null, 'invalid_type', TypeError],
  ['amount', NaN, 'not_finite', TypeError], ['amount', Infinity, 'not_finite', TypeError],
  ['amount', -1, 'out_of_range', RangeError], ['amount', 1e9 + 0.01, 'out_of_range', RangeError],
  ['amount', 0.001, 'invalid_step', RangeError], ['amount', 999999999.999, 'invalid_step', RangeError],
  ['year', '1', 'invalid_type', TypeError], ['year', NaN, 'not_finite', TypeError],
  ['year', 0, 'out_of_range', RangeError], ['year', 3, 'out_of_range', RangeError],
  ['year', 1.5, 'not_integer', RangeError],
])('rejects %s = %s without partially calculating', (field, value, code, errorType) => {
  const input = {
    ...parameters, oneTimeContributions: [{ year: 1, amount: 100 }, { year: 1, amount: 1, [field]: value }],
  }
  expect(validateInvestment(input)).toEqual({ [`oneTimeContributions.1.${field}`]: code })
  expect(() => calculateInvestment(input)).toThrow(errorType)
})
