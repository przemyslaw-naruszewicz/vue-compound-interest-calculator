import { describe, expect, test } from 'vitest'
import { calculateInvestment } from './calculateInvestment.js'
import { DEFAULT_INVESTMENT_PARAMETERS } from './investmentConstraints.js'

// Independent ordinary-annuity fixtures from the task, checked with 50-digit
// decimal arithmetic. Expected values never use the production monthly loop.
test.each([
  {
    parameters: { initialInvestment: 10000, monthlyContribution: 500, durationYears: 10, annualReturn: 7 },
    expected: { investedCapital: 70000, finalValue: 106639.0174837243, investmentGain: 36639.0174837243 },
  },
  {
    parameters: { initialInvestment: 1000, monthlyContribution: 0, durationYears: 1, annualReturn: 12 },
    expected: { investedCapital: 1000, finalValue: 1126.825030131970, investmentGain: 126.825030131970 },
  },
  {
    parameters: { initialInvestment: 0, monthlyContribution: 100, durationYears: 1, annualReturn: 12 },
    expected: { investedCapital: 1200, finalValue: 1268.250301319697, investmentGain: 68.250301319697 },
  },
])('matches the independent reference for $parameters', ({ parameters, expected }) => {
  const result = calculateInvestment(Object.freeze(parameters))

  expect(result.investedCapital).toBe(expected.investedCapital)
  expect(Math.abs(result.finalValue - expected.finalValue)).toBeLessThanOrEqual(1e-6)
  expect(Math.abs(result.investmentGain - expected.investmentGain)).toBeLessThanOrEqual(1e-6)
})

test('matches the maximum reference with relative tolerance and finite results', () => {
  const result = calculateInvestment({
    initialInvestment: 1_000_000_000,
    monthlyContribution: 1_000_000_000,
    durationYears: 40,
    annualReturn: 15,
  })

  expect(result.investedCapital).toBe(481000000000)
  // Keep the decimal references intact; conversion here intentionally uses
  // Number precision, which the relative tolerance accounts for.
  for (const [field, decimalReference] of Object.entries({
    finalValue: '31404755458750.2377',
    investmentGain: '30923755458750.2377',
  })) {
    const expected = Number(decimalReference)
    expect(Number.isFinite(result[field])).toBe(true)
    expect(Math.abs(result[field] - expected) / expected).toBeLessThanOrEqual(1e-12)
  }
})

test('returns the exact zero-rate reference', () => {
  expect(calculateInvestment({ ...DEFAULT_INVESTMENT_PARAMETERS, annualReturn: 0 }))
    .toStrictEqual({ investedCapital: 70000, finalValue: 70000, investmentGain: 0 })
})

test.each([0, 0.1, 7, 15])('returns exact zeros for zero amounts at %s%%', (annualReturn) => {
  expect(calculateInvestment({
    initialInvestment: 0,
    monthlyContribution: 0,
    durationYears: 40,
    annualReturn,
  })).toStrictEqual({ investedCapital: 0, finalValue: 0, investmentGain: 0 })
})

describe.each([0, -0])('signed zero initial capital %s', (initialInvestment) => {
  test.each([0, -0])('normalizes a zero contribution %s at zero and positive rates', (monthlyContribution) => {
    for (const annualReturn of [0, -0, 0.1, 15]) {
      expect(calculateInvestment({
        initialInvestment,
        monthlyContribution,
        durationYears: 1,
        annualReturn,
      })).toStrictEqual({ investedCapital: 0, finalValue: 0, investmentGain: 0 })
    }
  })
})

test.each([0.01, 123.45, 146048212.02, 999999999.99])(
  'calculates with valid cent amounts %s without rounding',
  (amount) => {
    expect(calculateInvestment({
      initialInvestment: amount,
      monthlyContribution: 0,
      durationYears: 1,
      annualReturn: 0,
    })).toStrictEqual({ investedCapital: amount, finalValue: amount, investmentGain: 0 })

    const result = calculateInvestment({
      initialInvestment: 0,
      monthlyContribution: amount,
      durationYears: 1,
      annualReturn: 0,
    })
    expect(result.investedCapital).toBe(amount * 12)
    expect(result.finalValue).toBe(result.investedCapital)
    expect(result.investmentGain).toBe(0)
  },
)

test('returns independent plain objects with only the financial fields', () => {
  const parameters = Object.freeze({ ...DEFAULT_INVESTMENT_PARAMETERS })
  const first = calculateInvestment(parameters)
  const second = calculateInvestment(parameters)

  expect(first).toStrictEqual(second)
  expect(first).not.toBe(second)
  expect(Object.getPrototypeOf(first)).toBe(Object.prototype)
  expect(Object.keys(first).sort()).toEqual(['finalValue', 'investedCapital', 'investmentGain'])
  first.finalValue = 0
  expect(second.finalValue).toBeGreaterThan(second.investedCapital)
  expect(parameters).toEqual(DEFAULT_INVESTMENT_PARAMETERS)
})

test('retains fractional gains without rounding to cents', () => {
  const result = calculateInvestment(DEFAULT_INVESTMENT_PARAMETERS)

  expect(result.finalValue).not.toBe(Math.round(result.finalValue * 100) / 100)
  expect(result.investmentGain).toBe(result.finalValue - result.investedCapital)
})

test.each([undefined, null, [], '', '1000', 1, true, () => {}])(
  'throws TypeError for an invalid parameter shape: %s',
  (parameters) => {
    expect(() => calculateInvestment(parameters)).toThrow(TypeError)
  },
)

test('throws TypeError when required parameters are missing', () => {
  expect(() => calculateInvestment({})).toThrow(TypeError)
})

describe.each(Object.keys(DEFAULT_INVESTMENT_PARAMETERS))('%s calculation boundary', (field) => {
  test('throws TypeError for a missing field', () => {
    const parameters = { ...DEFAULT_INVESTMENT_PARAMETERS }
    delete parameters[field]

    expect(() => calculateInvestment(parameters)).toThrow(TypeError)
  })

  test.each([undefined, null, '7', true, [], {}, new Number(7), 7n, NaN, Infinity, -Infinity])(
    'throws TypeError for %s without coercion',
    (value) => {
      expect(() => calculateInvestment({ ...DEFAULT_INVESTMENT_PARAMETERS, [field]: value }))
        .toThrow(TypeError)
    },
  )

  test('throws RangeError for a finite negative value', () => {
    expect(() => calculateInvestment({ ...DEFAULT_INVESTMENT_PARAMETERS, [field]: -1 }))
      .toThrow(RangeError)
  })
})

test.each([
  ['initialInvestment', 1_000_000_000.01],
  ['monthlyContribution', 1_000_000_000.01],
  ['initialInvestment', 0.001],
  ['monthlyContribution', 123.456],
  ['initialInvestment', 146048212.021],
  ['monthlyContribution', 999999999.999],
  ['durationYears', 0],
  ['durationYears', 41],
  ['durationYears', 1.5],
  ['durationYears', 1 + Number.EPSILON],
  ['annualReturn', 15.1],
  ['annualReturn', 7.05],
])('throws RangeError for %s = %s', (field, value) => {
  expect(() => calculateInvestment({ ...DEFAULT_INVESTMENT_PARAMETERS, [field]: value }))
    .toThrow(RangeError)
})

test('prioritizes TypeError when type and numeric constraint errors coexist', () => {
  expect(() => calculateInvestment({
    ...DEFAULT_INVESTMENT_PARAMETERS,
    initialInvestment: -1,
    annualReturn: '7',
  })).toThrow(TypeError)
})

describe.each([0, 1_000_000_000])('finite results with initial capital %s', (initialInvestment) => {
  test.each([0, 1_000_000_000])('supports contribution boundary %s across year/rate boundaries', (monthlyContribution) => {
    for (const durationYears of [1, 40]) {
      for (const annualReturn of [0, 0.1, 15]) {
        const result = calculateInvestment({
          initialInvestment,
          monthlyContribution,
          durationYears,
          annualReturn,
        })

        for (const value of Object.values(result)) {
          expect(Number.isFinite(value)).toBe(true)
          expect(value).toBeGreaterThanOrEqual(0)
        }
        expect(result.finalValue).toBeGreaterThanOrEqual(result.investedCapital)
        if (annualReturn === 0) {
          expect(result.finalValue).toBe(result.investedCapital)
          expect(result.investmentGain).toBe(0)
        }
      }
    }
  })
})
