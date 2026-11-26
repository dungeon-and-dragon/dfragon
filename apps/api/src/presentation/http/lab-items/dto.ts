import type { LabItems } from '#application/lab-items/index.js'

export type LabItemsResponse = LabItems

const CURRENCY_ID_DIGITS = /^[1-9]\d{0,14}$/

export function readCurrencyId(value: string): number | null {
  if (!CURRENCY_ID_DIGITS.test(value)) {
    return null
  }

  return Number(value)
}
