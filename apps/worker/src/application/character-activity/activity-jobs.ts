import type { CharacterBasicInput, CollectedCharacter, FameRefreshTarget } from '@dfragon/database'
import { z } from 'zod'
import { CharacterCollectionFailure } from '#domain/character-collection/index.js'
import { activityRange, needsActivityCheck } from '#domain/character-activity/index.js'
import { defineJob, fetchGroupWithRetry, NEOPLE_APIS } from '#application/jobs/index.js'
import type { CharacterActivityPorts } from './ports.js'
import type { CharacterActivityRepository } from './repository.js'

export { UNAVAILABLE_PAUSE_MS } from '#application/jobs/index.js'

const PAGE_SIZE = 1024

// 기본 정보를 받은 캐릭터 약 576만 명(2026-11-19 운영 DB)이 모두 활성이면 첫 실행은 타임라인과 기본 정보로 약 1,150만 요청이다.
// worker의 초당 상한 800에서 다른 요청 없이 4시간이 걸리므로(추정, 실측 없음) 두 배를 둔다.
const FAME_REFRESH_DELAY_MINUTES = 8 * 60

// 비활성 캐릭터는 많아야 576만 명이고 캐릭터마다 타임라인 한 번이라 명성 갱신의 절반 이하다.
const INACTIVE_RECHECK_DELAY_MINUTES = 4 * 60

type Outcome = 'refreshed' | 'inactive' | 'reactivated' | 'skipped' | 'unavailable'

type Counts = Record<Exclude<Outcome, 'unavailable'>, number>

export type FameRefreshSummary = {
  characters: number
  refreshed: number
  inactive: number
  skipped: number
}

export type InactiveRecheckSummary = {
  characters: number
  reactivated: number
  inactive: number
  skipped: number
}

export class CharacterActivityService {
  constructor(
    private readonly repository: CharacterActivityRepository,
    private readonly ports: CharacterActivityPorts
  ) {}

  async refreshFame(
    reportProgress: (done: number, total: number) => void
  ): Promise<FameRefreshSummary> {
    const total = await this.repository.countRefreshTargets()
    const { counts, done } = await this.sweep(
      total,
      (after) => this.repository.readRefreshTargets(after, PAGE_SIZE),
      (target) => this.refreshCharacter(target),
      reportProgress
    )
    const { refreshed, inactive, skipped } = counts

    return { characters: done, refreshed, inactive, skipped }
  }

  async recheckInactive(
    reportProgress: (done: number, total: number) => void
  ): Promise<InactiveRecheckSummary> {
    const total = await this.repository.countInactive()
    const { counts, done } = await this.sweep(
      total,
      (after) => this.repository.readInactive(after, PAGE_SIZE),
      (character) => this.recheckCharacter(character),
      reportProgress
    )
    const { reactivated, inactive, skipped } = counts

    return { characters: done, reactivated, inactive, skipped }
  }

  // 실행 중에 비활성으로 바뀐 캐릭터가 대상에서 빠져도 건너뛰지 않게 위치 대신 마지막 캐릭터 다음부터 읽는다.
  private async sweep<Target extends CollectedCharacter>(
    total: number,
    readPage: (after: CollectedCharacter | null) => Promise<Target[]>,
    handle: (target: Target) => Promise<Outcome>,
    reportProgress: (done: number, total: number) => void
  ): Promise<{ counts: Counts; done: number }> {
    const { readConcurrency, pause, report } = this.ports
    const counts: Counts = { refreshed: 0, inactive: 0, reactivated: 0, skipped: 0 }
    let after: Target | null = null
    let done = 0

    reportProgress(0, total)

    for (;;) {
      const page = await readPage(after)

      if (page.length === 0) {
        return { counts, done }
      }

      let position = 0

      while (position < page.length) {
        const group = page.slice(position, position + readConcurrency())
        const outcomes = await fetchGroupWithRetry(
          group,
          (targets) => Promise.all(targets.map(handle)),
          {
            isUnavailable: (outcome) => outcome === 'unavailable',
            pause,
            onUnavailable: ({ attempted, unavailable, paused }) => {
              report('CHARACTER_ACTIVITY_NEOPLE_UNAVAILABLE', {
                done,
                characters: attempted,
                unavailable: unavailable.length,
                paused: paused ? 1 : 0
              })
            }
          }
        )

        for (const outcome of outcomes) {
          const counted = outcome === 'unavailable' ? 'skipped' : outcome
          counts[counted]++
        }

        position += group.length
        done += group.length
        reportProgress(done, Math.max(total, done))
      }

      after = page.at(-1) ?? null
    }
  }

  private async refreshCharacter(target: FameRefreshTarget): Promise<Outcome> {
    const { serverId, characterId, lastActiveAt } = target
    const character = { serverId, characterId }
    const checkedAt = this.ports.now()

    if (needsActivityCheck(lastActiveAt, checkedAt)) {
      const activity = await this.ports.fetchLatestActivity(character, activityRange(checkedAt))

      if (activity.status === 'unavailable') {
        return 'unavailable'
      }

      if (activity.status === 'failed') {
        return 'skipped'
      }

      if (activity.status === 'idle') {
        await this.repository.recordInactive(character, checkedAt)

        return 'inactive'
      }

      await this.repository.recordActive(character, activity.lastActiveAt)
    }

    let basic: CharacterBasicInput

    try {
      basic = await this.ports.fetchBasic(character)
    } catch (error) {
      if (!(error instanceof CharacterCollectionFailure)) {
        throw error
      }

      // 한도 초과, 점검, timeout은 캐릭터 문제가 아니라 쉬었다가 같은 캐릭터를 다시 부른다.
      if (error.kind === 'unavailable' || error.kind === 'timeout') {
        return 'unavailable'
      }

      return 'skipped'
    }

    await this.repository.recordBasic(basic)

    return 'refreshed'
  }

  private async recheckCharacter(character: CollectedCharacter): Promise<Outcome> {
    const range = activityRange(this.ports.now())
    const activity = await this.ports.fetchLatestActivity(character, range)

    if (activity.status === 'unavailable') {
      return 'unavailable'
    }

    if (activity.status === 'failed') {
      return 'skipped'
    }

    if (activity.status === 'idle') {
      return 'inactive'
    }

    await this.repository.recordActive(character, activity.lastActiveAt)

    return 'reactivated'
  }
}

export function createFameRefreshJob(service: CharacterActivityService) {
  return defineJob({
    name: 'character-fame-refresh',
    displayName: '명성 갱신',
    description:
      '기본 정보를 저장한 활성 캐릭터의 명성을 매일 Neople에서 다시 받습니다. 최근 30일 동안 타임라인이 없는 캐릭터는 비활성으로 기록하고 명성을 받지 않습니다.',
    schedule: '0 3 * * *',
    argsSchema: z.object({}),
    delayMinutes: FAME_REFRESH_DELAY_MINUTES,
    neopleApi: NEOPLE_APIS.fameRefresh,
    run: (_args, { reportProgress }) => service.refreshFame(reportProgress)
  })
}

export function createInactiveRecheckJob(service: CharacterActivityService) {
  return defineJob({
    name: 'inactive-character-recheck',
    displayName: '비활성 캐릭터 재확인',
    description:
      '매월 마지막 날 비활성 캐릭터의 최근 30일 타임라인을 다시 보고, 활동이 있으면 활성으로 돌려 다음 명성 갱신에 넣습니다.',
    schedule: '0 4 L * *',
    argsSchema: z.object({}),
    delayMinutes: INACTIVE_RECHECK_DELAY_MINUTES,
    neopleApi: NEOPLE_APIS.timeline,
    run: (_args, { reportProgress }) => service.recheckInactive(reportProgress)
  })
}
