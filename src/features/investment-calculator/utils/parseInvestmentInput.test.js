import { expect, test } from 'vitest'
import { parseInvestmentInput } from './parseInvestmentInput.js'

test.each([
  ['1000', 1000],
  ['1000.50', 1000.5],
  ['1000,50', 1000.5],
  [' 0 ', 0],
  ['500', 500],
  ['500.00', 500],
  ['0.01', 0.01],
  ['00012,30', 12.3],
  ['\t123.45\n', 123.45],
  ['146048212.02', 146048212.02],
  ['999999999.99', 999999999.99],
  ['1000000000', 1_000_000_000],
])('parses %j as %s', (draft, value) => {
  expect(parseInvestmentInput(draft)).toEqual({ value })
})

test.each(['', ' ', '\t\n'])('reports an empty draft as required: %j', (draft) => {
  expect(parseInvestmentInput(draft)).toEqual({ value: undefined, error: 'required' })
})

test.each([
  '1.', '.5', '1,', ',5', '1,000.00', '1 000', '1\u00a0000', '1e3', '0x10',
  '+1', '-1', '1abc', '1.001', '1,001', '1_000', '1.000.00', 'NaN', 'Infinity',
  '１２', '1\n2',
])('rejects unsupported syntax: %j', (draft) => {
  expect(parseInvestmentInput(draft)).toEqual({ value: undefined, error: 'invalid_format' })
})

test.each([undefined, null, 0, 500, NaN, true, [], {}])(
  'rejects a non-string draft without coercion: %s',
  (draft) => {
    expect(parseInvestmentInput(draft)).toEqual({ value: undefined, error: 'invalid_type' })
  },
)

test('leaves numeric range and finiteness validation to the domain', () => {
  expect(parseInvestmentInput('1000000000.01')).toEqual({ value: 1_000_000_000.01 })
  expect(parseInvestmentInput('9'.repeat(400))).toEqual({ value: Infinity })
})
