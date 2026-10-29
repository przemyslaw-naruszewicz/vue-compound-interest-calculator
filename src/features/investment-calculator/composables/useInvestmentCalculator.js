import { computed, ref } from 'vue'
import { calculateInvestment } from '../domain/calculateInvestment.js'
import { DEFAULT_INVESTMENT_PARAMETERS } from '../domain/investmentConstraints.js'
import { validateInvestment } from '../domain/validateInvestment.js'
import { parseInvestmentInput } from '../utils/parseInvestmentInput.js'

function createAmountDraft(initialValue, initialError) {
  const text = ref(initialValue === undefined ? '' : String(initialValue))
  const edited = ref(false)
  const draft = computed({
    get: () => text.value,
    set: (value) => {
      text.value = value
      edited.value = true
    },
  })
  const parsed = computed(() => {
    // Displaying an initial value as text must not validate a coerced value.
    // Only an explicit edit switches this field to draft parsing.
    if (!edited.value) {
      return {
        value: typeof initialValue === 'number' ? initialValue : undefined,
        error: initialError,
      }
    }

    return parseInvestmentInput(text.value)
  })

  return { draft, parsed }
}

/**
 * Own one calculator's editable state. Omit the argument to use shared defaults;
 * a supplied object is a complete seed, so missing/invalid fields stay invalid.
 * Seeds are read once. Amount drafts are writable refs; assign numeric values
 * to the slider refs only on user updates, never from native range clamping.
 *
 * parameters, errors, isValid, and result are computed. Errors combine the
 * domain codes with the parser's invalid_format code; invalid results are null.
 *
 * @param {import('../domain/validateInvestment.js').InvestmentParameters} initialParameters
 */
export function useInvestmentCalculator(initialParameters = DEFAULT_INVESTMENT_PARAMETERS) {
  const initialErrors = validateInvestment(initialParameters)
  const initialInvestment = createAmountDraft(
    initialParameters.initialInvestment,
    initialErrors.initialInvestment,
  )
  const monthlyContribution = createAmountDraft(
    initialParameters.monthlyContribution,
    initialErrors.monthlyContribution,
  )
  const durationYears = ref(initialParameters.durationYears)
  const annualReturn = ref(initialParameters.annualReturn)
  const contributionDrafts = ref([])
  let nextContributionId = 1
  const parsedContributions = computed(() => contributionDrafts.value.map((row) => ({
    amount: parseInvestmentInput(row.amountDraft),
    year: row.yearDraft.trim() === ''
      ? { error: 'required' }
      : /^\d+$/.test(row.yearDraft.trim())
        ? { value: Number(row.yearDraft.trim()) }
        : { error: 'invalid_format' },
  })))

  function addContribution() {
    const id = nextContributionId++
    contributionDrafts.value.push({ id, amountDraft: '', yearDraft: '1' })
    return id
  }

  function updateContribution(id, field, value) {
    const row = contributionDrafts.value.find((row) => row.id === id)
    if (row && ['amountDraft', 'yearDraft'].includes(field)) row[field] = value
  }

  function removeContribution(id) {
    contributionDrafts.value = contributionDrafts.value.filter((row) => row.id !== id)
  }

  const parameters = computed(() => ({
    initialInvestment: initialInvestment.parsed.value.value,
    monthlyContribution: monthlyContribution.parsed.value.value,
    durationYears: durationYears.value,
    annualReturn: annualReturn.value,
    ...(contributionDrafts.value.length ? {
      oneTimeContributions: parsedContributions.value.map(({ year, amount }) => ({
        year: year.value, amount: amount.value,
      })),
    } : {}),
  }))
  const errors = computed(() => {
    const fieldErrors = validateInvestment(parameters.value)

    for (const [field, amount] of Object.entries({ initialInvestment, monthlyContribution })) {
      if (amount.parsed.value.error) {
        fieldErrors[field] = amount.parsed.value.error
      }
    }

    parsedContributions.value.forEach((row, index) => {
      for (const field of ['amount', 'year']) {
        if (row[field].error) fieldErrors[`oneTimeContributions.${index}.${field}`] = row[field].error
      }
    })

    return fieldErrors
  })
  const isValid = computed(() => Object.keys(errors.value).length === 0)
  const result = computed(() => (
    isValid.value ? calculateInvestment(parameters.value) : null
  ))
  const contributions = computed(() => contributionDrafts.value.map((row, index) => ({
    ...row,
    errors: {
      amount: errors.value[`oneTimeContributions.${index}.amount`],
      year: errors.value[`oneTimeContributions.${index}.year`],
    },
  })))

  return {
    initialInvestmentDraft: initialInvestment.draft,
    monthlyContributionDraft: monthlyContribution.draft,
    durationYears,
    annualReturn,
    contributions,
    addContribution,
    updateContribution,
    removeContribution,
    parameters,
    errors,
    isValid,
    result,
  }
}
