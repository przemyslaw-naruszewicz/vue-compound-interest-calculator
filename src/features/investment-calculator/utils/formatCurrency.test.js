import { describe, expect, test, vi } from 'vitest'
import { createCurrencyFormatter } from './formatCurrency.js'

const intlFormat = (locale, currency, value) => (
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value)
)

test('defaults to Polish PLN formatting and exposes the effective settings', () => {
  const formatter = createCurrencyFormatter()
  expect(formatter.locale).toBe('pl-PL')
  expect(formatter.currency).toBe('PLN')
  expect(formatter.notice).toBe('')
  for (const value of [106639.02034474857, 70000, 36639.02034474857]) {
    expect(formatter.format(value)).toBe(intlFormat('pl-PL', 'PLN', value))
  }
})

test.each([
  ['en-US', 'USD', 2], ['ja-JP', 'JPY', 0], ['ar-KW', 'KWD', 3],
])('uses %s / %s with its default minor-unit digits', (locale, currency, digits) => {
  const formatter = createCurrencyFormatter(locale, currency)
  expect(formatter.locale).toBe(locale)
  expect(formatter.currency).toBe(currency)
  expect(formatter.notice).toBe('')
  const value = 1234567.89123
  expect(formatter.format(value)).toBe(intlFormat(locale, currency, value))
  const fraction = new Intl.NumberFormat(locale, { style: 'currency', currency })
    .formatToParts(value).find((part) => part.type === 'fraction')
  expect(fraction?.value.length ?? 0).toBe(digits)
})

describe('independent fallbacks', () => {
  test.each(['', 'not_a_locale', 'zz-ZZ', null, 123, [], {}])(
    'falls back for locale %j while retaining USD', (locale) => {
      const formatter = createCurrencyFormatter(locale, 'USD')
      expect(formatter.locale).toBe('pl-PL')
      expect(formatter.currency).toBe('USD')
      expect(formatter.notice).toContain('Using pl-PL')
      expect(formatter.notice).not.toContain('Using PLN')
      expect(formatter.format(1234.56)).toBe(intlFormat('pl-PL', 'USD', 1234.56))
    },
  )

  test.each(['', 'usd', 'US', 'USDD', '12X', ' USD ', null, 123, [], {}])(
    'falls back for currency %j while retaining en-US', (currency) => {
      const formatter = createCurrencyFormatter('en-US', currency)
      expect(formatter.locale).toBe('en-US')
      expect(formatter.currency).toBe('PLN')
      expect(formatter.notice).toContain('Using PLN')
      expect(formatter.notice).not.toContain('Using pl-PL')
      expect(formatter.format(1234.56)).toBe(intlFormat('en-US', 'PLN', 1234.56))
    },
  )

  test('reports both fallbacks and formats safely', () => {
    const formatter = createCurrencyFormatter('invalid_locale', 'invalid')
    expect(formatter.notice).toContain('Using pl-PL')
    expect(formatter.notice).toContain('Using PLN')
    expect(formatter.format(1234.56)).toBe(intlFormat('pl-PL', 'PLN', 1234.56))
  })

  test('catches currency construction failures while retaining a supported locale', () => {
    const NumberFormat = Intl.NumberFormat
    const spy = vi.spyOn(Intl, 'NumberFormat').mockImplementation(function (locale, options) {
      if (options?.currency === 'USD') throw new RangeError('Unavailable currency')
      return new NumberFormat(locale, options)
    })
    spy.supportedLocalesOf = NumberFormat.supportedLocalesOf
    try {
      const formatter = createCurrencyFormatter('en-US', 'USD')
      expect(formatter.locale).toBe('en-US')
      expect(formatter.currency).toBe('PLN')
      expect(formatter.notice).toContain('Using PLN')
    } finally {
      spy.mockRestore()
    }
  })

  test('catches locale construction failures while retaining a valid currency', () => {
    const NumberFormat = Intl.NumberFormat
    const spy = vi.spyOn(Intl, 'NumberFormat').mockImplementation(function (locale, options) {
      if (locale === 'ja-JP') throw new RangeError('Unavailable locale')
      return new NumberFormat(locale, options)
    })
    spy.supportedLocalesOf = NumberFormat.supportedLocalesOf
    try {
      const formatter = createCurrencyFormatter('ja-JP', 'USD')
      expect(formatter.locale).toBe('pl-PL')
      expect(formatter.currency).toBe('USD')
      expect(formatter.notice).toContain('Using pl-PL')
      expect(formatter.notice).not.toContain('Using PLN')
    } finally {
      spy.mockRestore()
    }
  })
})

test('accepts canonical locales and unrecognized uppercase three-letter currencies', () => {
  const formatter = createCurrencyFormatter('en-us', 'ZZZ')
  expect(formatter.locale).toBe('en-US')
  expect(formatter.currency).toBe('ZZZ')
  expect(formatter.notice).toBe('')
  expect(formatter.format(123)).toBe(intlFormat('en-US', 'ZZZ', 123))
})

test.each(['PLN', 'JPY', 'KWD'])('avoids negative zero, including rounded zero, for %s', (currency) => {
  const formatter = createCurrencyFormatter('en-US', currency)
  for (const value of [0, -0, -0.00001]) {
    expect(formatter.format(value)).toBe(formatter.format(0))
  }
  expect(formatter.format(-123.456)).toBe(intlFormat('en-US', currency, -123.456))
})

test.each([NaN, Infinity, -Infinity, undefined, null, '123'])('hides non-finite/non-numeric %s', (value) => {
  expect(createCurrencyFormatter().format(value)).toBe('—')
})
