const DEFAULT_LOCALE = 'pl-PL'
const DEFAULT_CURRENCY = 'PLN'

/** Resolve presentation settings independently; amounts are never converted. */
export function createCurrencyFormatter(locale = DEFAULT_LOCALE, currency = DEFAULT_CURRENCY) {
  let effectiveLocale = DEFAULT_LOCALE
  let effectiveCurrency = DEFAULT_CURRENCY
  const notices = []

  try {
    if (typeof locale !== 'string' || Intl.NumberFormat.supportedLocalesOf([locale]).length === 0) {
      throw new RangeError('Unsupported locale')
    }
    effectiveLocale = new Intl.NumberFormat(locale).resolvedOptions().locale
  } catch {
    notices.push(`Unsupported locale. Using ${DEFAULT_LOCALE} for number formatting.`)
  }

  let formatter
  try {
    if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) {
      throw new RangeError('Invalid currency')
    }
    formatter = new Intl.NumberFormat(effectiveLocale, {
      style: 'currency', currency, signDisplay: 'negative',
    })
    effectiveCurrency = formatter.resolvedOptions().currency
  } catch {
    notices.push(`Invalid currency. Using ${DEFAULT_CURRENCY} for amounts and labels.`)
    formatter = new Intl.NumberFormat(effectiveLocale, {
      style: 'currency', currency: DEFAULT_CURRENCY, signDisplay: 'negative',
    })
  }

  return {
    locale: effectiveLocale,
    currency: effectiveCurrency,
    notice: notices.join(' '),
    format: (value) => Number.isFinite(value) ? formatter.format(value) : '—',
  }
}
