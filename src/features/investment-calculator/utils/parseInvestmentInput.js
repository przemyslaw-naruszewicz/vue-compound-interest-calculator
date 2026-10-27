/**
 * Parse a monetary draft without changing it. A comma is always decimal.
 * Numeric bounds, finiteness, and steps belong to validateInvestment.
 *
 * @param {string} draft
 * @returns {{ value: number | undefined, error?: 'required' | 'invalid_type' | 'invalid_format' }}
 */
export function parseInvestmentInput(draft) {
  if (typeof draft !== 'string') {
    return { value: undefined, error: 'invalid_type' }
  }

  const text = draft.trim()

  if (text === '') {
    return { value: undefined, error: 'required' }
  }
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) {
    return { value: undefined, error: 'invalid_format' }
  }

  return { value: Number(text.replace(',', '.')) }
}
