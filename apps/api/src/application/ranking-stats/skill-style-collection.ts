import { setTimeout } from 'node:timers/promises'
import { z } from 'zod'
import { defineJob } from '../jobs/definition.js'
import type {
  SkillStyleCollectionStore,
  SkillStyleCollectionDependencies,
  SkillStyleCollectionJobDependencies
} from './ports.js'

export const UNAVAILABLE_PAUSE_MS = 60_000

// 운영 표본 35.5만 명(2026-11-10)을 초당 40건으로 처음부터 채우면 2시간 반이 걸린다.
// 다른 수집과 Neople 요청을 나눠 보내므로 두 배 넘게 둔다.
const DELAY_MINUTES = 6 * 60

export type SkillStyleCollectionSummary = {
  characters: number
  saved: number
  skipped: number
}

/** 저장한 캐릭터는 다음 실행의 대상에서 빠지므로, 도중에 끝난 수집은 다시 실행하면 남은 캐릭터부터 받는다. */
export async function collectSkillStyles({
  store,
  fetchSkillStyle,
  concurrency,
  now,
  pause,
  report,
  reportProgress
}: SkillStyleCollectionDependencies): Promise<SkillStyleCollectionSummary> {
  const targets = await store.readTargets()
  const counts = { saved: 0, skipped: 0 }
  reportProgress(0, targets.length)

  let done = 0
  while (done < targets.length) {
    const group = targets.slice(done, done + concurrency)
    const results = await Promise.all(group.map((character) => fetchSkillStyle(character, now)))
    if (results.some(({ status }) => status === 'unavailable')) {
      report('SKILL_STYLE_NEOPLE_UNAVAILABLE', { done })
      await pause(UNAVAILABLE_PAUSE_MS)
      continue
    }
    for (const result of results) {
      if (result.status === 'fetched') {
        await store.recordSkillStyle(result.style)
        counts.saved++
      } else {
        counts.skipped++
      }
    }
    done += group.length
    reportProgress(done, targets.length)
  }

  return { characters: targets.length, ...counts }
}

export function createSkillStyleCollectionJob(
  store: SkillStyleCollectionStore,
  dependencies: SkillStyleCollectionJobDependencies
) {
  return defineJob({
    name: 'skill-style-collection',
    displayName: '스킬 스타일 수집',
    description:
      '스킬 채택률 표본 가운데 스킬 스타일이 없는 캐릭터의 스킬 스타일을 Neople에서 받아 저장합니다. 다시 실행하면 남은 캐릭터부터 받습니다.',
    argsSchema: z.object({}),
    delayMinutes: DELAY_MINUTES,
    run: (_args, { reportProgress }) =>
      collectSkillStyles({
        ...dependencies,
        store,
        now: () => new Date(),
        pause: (ms) => setTimeout(ms),
        reportProgress
      })
  })
}
