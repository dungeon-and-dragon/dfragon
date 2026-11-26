import type { LabCurrencySummary } from '@dfragon/database'
import { z } from 'zod'
import { OpsFailure } from '#domain/failure.js'
import { descriptionField, iconField } from '#presentation/http/lab-fields.js'

const CURRENCY_ID_DIGITS = /^[1-9]\d{0,14}$/

const currencyIdParam = z.string().regex(CURRENCY_ID_DIGITS).transform(Number)

export function readCurrencyId(value: string): number {
  const id = currencyIdParam.safeParse(value)

  if (!id.success) {
    throw new OpsFailure('request')
  }

  return id.data
}

const name = z.string().trim().min(1)

export const addBody = z.object({ name, description: descriptionField, icon: iconField })

export const updateBody = z.object({
  name,
  description: descriptionField,
  icon: iconField.optional()
})

export type LabCurrencyResponse = LabCurrencySummary

export type LabCurrencyListResponse = {
  currencies: LabCurrencyResponse[]
}

export type LabCurrencyAdditionResponse = {
  id: number
}

export function toLabCurrencyListResponse(
  currencies: LabCurrencySummary[]
): LabCurrencyListResponse {
  return { currencies }
}

export function toLabCurrencyAdditionResponse(id: number): LabCurrencyAdditionResponse {
  return { id }
}
