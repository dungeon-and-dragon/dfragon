import { z } from 'zod'
import { defineJob } from '../jobs/definition.js'
import { createUnavailableStreaks } from '../jobs/unavailable-streaks.js'
import type { SkillStyleCollectionPorts } from './ports.js'
import type { SkillStyleCollectionRepository } from './repository.js'

export const UNAVAILABLE_PAUSE_MS = 60_000

// 운영 표본 35.5만 명(2026-11-10)을 초당 40건으로 처음부터 채우면 2시간 반이 걸린다.
// 다른 수집과 Neople 요청을 나눠 보내므로 두 배 넘게 둔다.
const DELAY_MINUTES = 6 * 60

export type SkillStyleCollectionSummary = {
  characters: number
  saved: number
  skipped: number
}

export class SkillStyleCollectionService {
  constructor(
    private readonly repository: SkillStyleCollectionRepository,
    private readonly ports: SkillStyleCollectionPorts
  ) {}

  /** 저장한 캐릭터는 다음 실행의 대상에서 빠지므로, 도중에 끝난 수집은 다시 실행하면 남은 캐릭터부터 받는다. */
  async collect(
    reportProgress: (done: number, total: number) => void
  ): Promise<SkillStyleCollectionSummary> {
    const { fetchSkillStyle, readConcurrency, now, pause, report } = this.ports
    const targets = await this.repository.readTargets()
    const counts = { saved: 0, skipped: 0 }
    reportProgress(0, targets.length)

    const unavailableStreaks = createUnavailableStreaks<(typeof targets)[number]>()
    let done = 0
    while (done < targets.length) {
      const group = targets.slice(done, done + readConcurrency())
      const results = await Promise.all(group.map((character) => fetchSkillStyle(character, now)))
      const unavailable = group.filter((_, index) => results[index]?.status === 'unavailable')
      if (unavailable.length > 0) {
        if (unavailableStreaks.decide(group.length, unavailable) === 'retry') {
          report('SKILL_STYLE_NEOPLE_UNAVAILABLE', {
            done,
            characters: group.length,
            unavailable: unavailable.length
          })
          await pause(UNAVAILABLE_PAUSE_MS)
          continue
        }
        for (const character of unavailable) {
          report('SKILL_STYLE_CHARACTER_SKIPPED', { position: done + group.indexOf(character) })
        }
      }
      for (const result of results) {
        if (result.status === 'fetched') {
          await this.repository.recordSkillStyle(result.style)
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
}

export function createSkillStyleCollectionJob(service: SkillStyleCollectionService) {
  return defineJob({
    name: 'skill-style-collection',
    displayName: '스킬 스타일 수집',
    description:
      '스킬 채택률 표본 가운데 스킬 스타일이 없는 캐릭터의 스킬 스타일을 Neople에서 받아 저장합니다. 다시 실행하면 남은 캐릭터부터 받습니다.',
    argsSchema: z.object({}),
    delayMinutes: DELAY_MINUTES,
    run: (_args, { reportProgress }) => service.collect(reportProgress)
  })
}
