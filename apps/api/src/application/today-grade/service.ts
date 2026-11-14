import { TodayGradeFailure, todayGradeFailure } from '../../domain/today-grade/failure.js'
import { averageGradePercent } from '../../domain/today-grade/grade.js'
import { TODAY_GRADE_ITEMS } from '../../domain/today-grade/items.js'
import { startOfNextSeoulDay } from '../../domain/seoul-time.js'
import type { FetchShopGrade } from './ports.js'

export interface TodayGrade {
  percent: number
  expiresAt: string
}

function waitForAbort(signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    signal.addEventListener('abort', () => resolve(), { once: true })
  })
}

export class TodayGradeService {
  private readonly shutdown = new AbortController()
  private cached: TodayGrade | undefined
  private loading: Promise<TodayGrade> | undefined

  constructor(
    private readonly fetchShopGrade: FetchShopGrade,
    private readonly now: () => Date = () => new Date()
  ) {}

  async get(requestSignal: AbortSignal): Promise<TodayGrade> {
    try {
      requestSignal.throwIfAborted()
      const current = this.cached
      if (current !== undefined && this.now().getTime() < Date.parse(current.expiresAt)) {
        return current
      }

      // 여러 요청이 한 조회를 함께 기다리므로 요청 하나의 연결 종료로 조회를 취소하지 않는다.
      this.loading ??= this.load().finally(() => {
        this.loading = undefined
      })
      const grade = await Promise.race([this.loading, waitForAbort(requestSignal)])

      if (grade === undefined) {
        throw new TodayGradeFailure('internal')
      }

      return grade
    } catch (error) {
      throw todayGradeFailure(error)
    }
  }

  async close(): Promise<void> {
    this.shutdown.abort()
    await this.loading?.catch(() => undefined)
  }

  private async load(): Promise<TodayGrade> {
    // 0시 직전에 시작한 조회는 전날 등급을 받았을 수 있으므로 시작 시각으로 만료를 정한다.
    const startedAt = this.now()
    const failure = new AbortController()
    const signal = AbortSignal.any([this.shutdown.signal, failure.signal])
    try {
      const values = await Promise.all(
        TODAY_GRADE_ITEMS.map(({ itemId }) => this.fetchShopGrade(itemId, signal))
      )
      this.shutdown.signal.throwIfAborted()
      const grade = {
        percent: averageGradePercent(values),
        expiresAt: startOfNextSeoulDay(startedAt).toISOString()
      }
      this.cached = grade

      return grade
    } catch (error) {
      failure.abort()
      throw error
    }
  }
}
