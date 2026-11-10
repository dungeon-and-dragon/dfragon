import { type FailureOptions, SanitizedFailure } from '../../error-chain.js'

export type TodayGradeFailureKind = 'internal' | 'api' | 'unavailable' | 'timeout'

export class TodayGradeFailure extends SanitizedFailure {
  readonly kind: TodayGradeFailureKind

  constructor(kind: TodayGradeFailureKind, options: FailureOptions = {}) {
    super(`Today grade failed: ${kind}`, options)
    this.name = 'TodayGradeFailure'
    this.kind = kind
  }
}

export function todayGradeFailure(error: unknown): TodayGradeFailure {
  if (error instanceof TodayGradeFailure) {
    return error
  }

  return new TodayGradeFailure('internal', { cause: error })
}
