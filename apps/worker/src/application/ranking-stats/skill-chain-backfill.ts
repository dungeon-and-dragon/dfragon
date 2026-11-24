import type { CharacterSkillStyleInput, SkillStyleChainBackfillRow } from '@dfragon/database'
import type { ParseCharacterSkillStyle } from '@dfragon/server-core/application/character-basic/ports.js'
import { z } from 'zod'
import { defineJob } from '#application/jobs/index.js'
import type { SkillChainBackfillRepository } from './repository.js'

const PAGE_SIZE = 500
// 운영에서 500행 한 페이지를 이력 원문과 함께 읽는 쿼리가 0.3초였다(2026-11-25, 스킬 스타일 행 약 44만 개).
// 행마다 UPDATE를 한 번 더 하므로 전체를 30분 안팎으로 보고 두 배를 둔다.
const DELAY_MINUTES = 60

export type SkillChainBackfillSummary = {
  characters: number
  filled: number
  noHistory: number
  jobChanged: number
  noChain: number
  changed: number
}

type BackfillDecision =
  | { status: 'fill'; style: CharacterSkillStyleInput }
  | { status: 'noHistory' | 'jobChanged' | 'noChain' }

// 원문의 스킬, 개화, 강화, 체인을 함께 써서 한 행에 다른 시점의 값이 섞이지 않게 한다.
function decideBackfill(
  { source, serverId, characterId, jobId, jobGrowId }: SkillStyleChainBackfillRow,
  parseSkillStyle: ParseCharacterSkillStyle
): BackfillDecision {
  if (source === null) {
    return { status: 'noHistory' }
  }

  if (source.jobId !== jobId || source.jobGrowId !== jobGrowId) {
    return { status: 'jobChanged' }
  }

  const parsed = parseSkillStyle({ ...source.body, jobId, jobGrowId })
  if (parsed === undefined || parsed.chain === null) {
    return { status: 'noChain' }
  }

  return {
    status: 'fill',
    style: { ...parsed, serverId, characterId, fetchedAt: source.observedAt }
  }
}

export class SkillChainBackfillService {
  constructor(
    private readonly repository: SkillChainBackfillRepository,
    private readonly parseSkillStyle: ParseCharacterSkillStyle
  ) {}

  /** 체인이 없는 행만 고치므로 다시 실행하면 남은 행만 다시 본다. */
  async backfill(reportProgress: (done: number) => void): Promise<SkillChainBackfillSummary> {
    const summary: SkillChainBackfillSummary = {
      characters: 0,
      filled: 0,
      noHistory: 0,
      jobChanged: 0,
      noChain: 0,
      changed: 0
    }
    let after: SkillStyleChainBackfillRow | null = null

    while (true) {
      const page = await this.repository.readPage({ after, limit: PAGE_SIZE })
      if (page.length === 0) {
        return summary
      }

      for (const row of page) {
        const decision = decideBackfill(row, this.parseSkillStyle)
        if (decision.status !== 'fill') {
          summary[decision.status]++
          continue
        }

        const filled = await this.repository.fillChain(decision.style)
        summary[filled ? 'filled' : 'changed']++
      }

      summary.characters += page.length
      after = page.at(-1) ?? null
      reportProgress(summary.characters)
    }
  }
}

export function createSkillChainBackfillJob(service: SkillChainBackfillService) {
  return defineJob({
    name: 'skill-chain-backfill',
    displayName: '스킬 체인 채우기',
    description:
      '스킬 체인이 없는 스킬 스타일 행을 그 캐릭터의 가장 새 스킬 스타일 이력 원문으로 다시 씁니다. 원문을 받을 때의 전직이 저장된 행과 같을 때만 쓰고, Neople은 부르지 않습니다.',
    argsSchema: z.object({}),
    delayMinutes: DELAY_MINUTES,
    neopleApi: null,
    run: (_args, { reportProgress }) => service.backfill(reportProgress)
  })
}
