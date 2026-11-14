import type { ClearPopulationCharacter, FinishedJobRun } from '@dfragon/database'
import { z } from 'zod'
import type { CharacterPayloads } from '../../domain/character-detail/sections.js'
import { CharacterDetailFailure } from '../../domain/character-failure.js'
import { type CalculatedScore, toCalculatedScore } from '../../domain/score/calculated.js'
import { defineJob } from '../jobs/definition.js'
import { createUnavailableStreaks } from '../jobs/unavailable-streaks.js'
import { calculateCharacterScore } from './calculate.js'
import type { ScoreCalculationPorts, ScoreEngineHandle, ScoreSources } from './ports.js'
import type { ScoreCalculationRepository } from './repository.js'

export const UNAVAILABLE_PAUSE_MS = 60_000

// 이어 계산할 위치를 이 이름의 실행 이력에서 읽는다.
export const SCORE_CALCULATION_JOB_NAME = 'score-calculation'

// 수요일 밤에 시작해 목요일 06:00(KST) 주간 초기화 전에 끝낸다. 첫 실행의 걸린 시간을 재고 설정으로 옮긴다.
export const DEFAULT_SCORE_CALCULATION_SCHEDULE = '0 22 * * 3'

// 대상 약 92만 명(2026-11-10 운영 DB)을 캐릭터당 상세 섹션 11번으로 받으면 약 1천만 요청이고, worker의 초당 상한 800에서
// 다른 요청 없이도 3시간 반이 걸린다(추정, 실측 없음). 시작부터 목요일 06:00까지인 8시간을 둔다.
const DELAY_MINUTES = 8 * 60

// 주 1회 실행이라 하루 넘게 지난 실행은 지난 주기의 것으로 보고 처음부터 계산한다.
const RESUME_WINDOW_MS = 24 * 60 * 60 * 1000

// job은 도중에 취소하지 않으므로 끝내 abort되지 않는 signal을 넘긴다.
const NEVER_ABORTED = AbortSignal.any([])

export type ScoreCalculationSummary = {
  characters: number
  resumedAt: number
  saved: number
  skipped: number
  requests: number
}

type CharacterScoreResult =
  | { status: 'scored'; score: CalculatedScore }
  | { status: 'skipped' }
  | { status: 'unavailable' }

type CharacterCalculation =
  | Exclude<CharacterScoreResult, { status: 'scored' }>
  | { status: 'calculated'; score: CalculatedScore | null; missingItems: boolean }

export class ScoreEngineUnavailable extends Error {
  readonly code: 'SCORE_ENGINE_NOT_CONFIGURED' | 'SCORE_ENGINE_STOPPED'

  constructor(code: ScoreEngineUnavailable['code']) {
    super('Score engine unavailable')
    this.name = 'ScoreEngineUnavailable'
    this.code = code
  }
}

export function resumePosition(run: FinishedJobRun | undefined, now: Date): number {
  if (run === undefined || run.status === 'succeeded' || run.progressDone === null) {
    return 0
  }

  if (now.getTime() - run.startedAt.getTime() > RESUME_WINDOW_MS) {
    return 0
  }

  return run.progressDone
}

async function calculateCharacter(
  character: ClearPopulationCharacter,
  { fetchDetails, catalog }: ScoreSources,
  engine: ScoreEngineHandle,
  now: () => Date
): Promise<CharacterCalculation> {
  const identity = { serverId: character.serverId, characterId: character.characterId }
  let payloads: CharacterPayloads

  try {
    payloads = await fetchDetails(identity, NEVER_ABORTED, () => undefined)
  } catch (error) {
    if (!(error instanceof CharacterDetailFailure)) {
      throw error
    }

    // 한도 초과, 점검, timeout은 캐릭터 문제가 아니라 쉬었다가 같은 캐릭터를 다시 부른다.
    if (error.kind === 'unavailable' || error.kind === 'timeout') {
      return { status: 'unavailable' }
    }

    return { status: 'skipped' }
  }

  const fetchedAt = now()
  const { result, missingItems } = await calculateCharacterScore(
    identity,
    { payloads, fetchedAt },
    catalog,
    engine.calculate,
    NEVER_ABORTED
  )
  const score = toCalculatedScore(result, now())

  return { status: 'calculated', score, missingItems }
}

/**
 * 아이템 상세 조회는 묶음의 캐릭터가 함께 쓰므로, 묶음 안에서 한도 초과, 점검, timeout이 있었을 때만 아이템이 빠진 계산을 버리고
 * 다시 받는다. 응답에 행이 없는 아이템처럼 다시 받아도 같은 경우는 상세 조회처럼 빠진 채로 저장한다.
 */
function settle(
  calculation: CharacterCalculation,
  itemLookupUnavailable: boolean
): CharacterScoreResult {
  if (calculation.status !== 'calculated') {
    return calculation
  }

  if (calculation.missingItems && itemLookupUnavailable) {
    return { status: 'unavailable' }
  }

  if (calculation.score === null) {
    return { status: 'skipped' }
  }

  return { status: 'scored', score: calculation.score }
}

export class ScoreCalculationService {
  constructor(
    private readonly repository: ScoreCalculationRepository,
    private readonly ports: ScoreCalculationPorts
  ) {}

  /**
   * 진행 위치는 실행 이력의 진행률이다. 도중에 끝난 실행을 하루 안에 다시 실행하면 그 위치부터 이어 계산한다.
   * 대상은 클리어 기록 수집과 같은 순서로 다시 읽으므로, 그 사이 최고 명성이 바뀐 캐릭터만큼 위치가 어긋날 수 있다.
   */
  async calculate(
    reportProgress: (done: number, total: number) => void
  ): Promise<ScoreCalculationSummary> {
    const { openEngine, createSources, readConcurrency, now, pause, report } = this.ports
    const engine = openEngine()

    if (engine === null) {
      throw new ScoreEngineUnavailable('SCORE_ENGINE_NOT_CONFIGURED')
    }

    const counts = { saved: 0, skipped: 0, requests: 0 }
    let itemLookupUnavailable = false
    const sources = createSources({
      onRequest: () => {
        counts.requests++
      },
      onItemLookupUnavailable: () => {
        itemLookupUnavailable = true
      }
    })

    try {
      const targets = await this.repository.readTargets()
      const resumedAt = resumePosition(await this.repository.readLastFinishedRun(), now())
      const unavailableStreaks = createUnavailableStreaks<ClearPopulationCharacter>()
      let done = resumedAt

      reportProgress(Math.min(resumedAt, targets.length), targets.length)

      while (done < targets.length) {
        const group = targets.slice(done, done + readConcurrency())

        itemLookupUnavailable = false
        const calculations = await Promise.all(
          group.map((character) => calculateCharacter(character, sources, engine, now))
        )
        const results = calculations.map((calculation) =>
          settle(calculation, itemLookupUnavailable)
        )

        // 라이브러리를 열지 못했거나 worker가 멈추면 계산이 모두 null이 되므로, 남은 캐릭터를 받지 않고 끝낸다.
        if (!engine.isRunning()) {
          throw new ScoreEngineUnavailable('SCORE_ENGINE_STOPPED')
        }

        const unavailable = group.filter((_, index) => results[index]?.status === 'unavailable')

        if (unavailable.length > 0) {
          if (unavailableStreaks.decide(group.length, unavailable) === 'retry') {
            report('SCORE_NEOPLE_UNAVAILABLE', {
              done,
              characters: group.length,
              unavailable: unavailable.length
            })
            await pause(UNAVAILABLE_PAUSE_MS)
            continue
          }

          for (const character of unavailable) {
            report('SCORE_CHARACTER_SKIPPED', { position: done + group.indexOf(character) })
          }
        }

        for (const [index, result] of results.entries()) {
          if (result.status === 'scored') {
            const { serverId, characterId } = group[index]!
            await this.repository.recordScore({ serverId, characterId, ...result.score })
            counts.saved++
          } else {
            counts.skipped++
          }
        }

        done += group.length
        reportProgress(done, targets.length)
      }

      return { characters: targets.length, resumedAt, ...counts }
    } finally {
      await Promise.allSettled([engine.close(), sources.catalog.close()])
    }
  }
}

export function createScoreCalculationJob(
  service: ScoreCalculationService,
  schedule: string = DEFAULT_SCORE_CALCULATION_SCHEDULE
) {
  return defineJob({
    name: SCORE_CALCULATION_JOB_NAME,
    displayName: '점수 계산',
    description:
      '클리어 기록 수집 대상 캐릭터의 상세 정보를 Neople에서 받아 장비 점수, 버프 점수를 계산해 저장합니다. 도중에 끝난 실행은 하루 안에 다시 실행하면 남은 캐릭터부터 계산합니다.',
    schedule,
    // 놓친 실행을 worker 시작 때 보충하면 낮에 시작해 클리어 기록 수집과 겹치므로, 정해진 일정과 수동 실행으로만 돈다.
    catchup: false,
    argsSchema: z.object({}),
    delayMinutes: DELAY_MINUTES,
    run: (_args, { reportProgress }) => service.calculate(reportProgress)
  })
}
