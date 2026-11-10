import type { ArgField, Job } from './api/ops-schemas'

export type ArgInput = {
  name: string
  field: ArgField
  required: boolean
}

export type ArgDraft = Readonly<Record<string, string>>

const NUMBER_TYPES = new Set(['integer', 'number'])
export const BOOLEAN_OPTIONS = ['true', 'false'] as const

export function argInputs(job: Job): ArgInput[] {
  const { properties = {}, required = [] } = job.argsSchema

  return Object.entries(properties).map(([name, field]) => ({
    name,
    field,
    required: required.includes(name)
  }))
}

export function choicesOf({ field }: ArgInput): readonly string[] | undefined {
  if (field.enum !== undefined) {
    return field.enum.map(String)
  }

  if (field.type === 'boolean') {
    return BOOLEAN_OPTIONS
  }

  return undefined
}

export function isNumberField({ field }: ArgInput): boolean {
  return field.type !== undefined && NUMBER_TYPES.has(field.type)
}

function argValue(input: ArgInput, text: string): unknown {
  const { field } = input
  if (field.type === 'boolean') {
    return text === 'true'
  }

  if (isNumberField(input)) {
    return Number(text)
  }

  return text
}

/** 빈 칸은 보내지 않아 worker의 인자 schema가 기본값과 필수 여부를 판단한다. */
export function argsFromDraft(
  inputs: readonly ArgInput[],
  draft: ArgDraft
): Record<string, unknown> {
  const args: Record<string, unknown> = {}
  for (const input of inputs) {
    const text = draft[input.name] ?? ''
    if (text !== '') {
      args[input.name] = argValue(input, text)
    }
  }

  return args
}
