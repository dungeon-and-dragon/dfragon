import { z } from 'zod'
import { defineJob } from '#application/jobs/index.js'
import type { LoweredHistoryTrimRepository } from './repository.js'

const PROGRESS_STEP = 500
// 운영에서 대상 조회가 4초, 대상이 4만 3천 명이었다(2026-11-28). 캐릭터마다 짧은 transaction 하나라 30분 안팎으로 보고 두 배를 둔다.
const DELAY_MINUTES = 60

export type LoweredHistoryTrimSummary = {
  characters: number
  trimmed: number
}

export class LoweredHistoryTrimService {
  constructor(private readonly repository: LoweredHistoryTrimRepository) {}

  /** 정리한 캐릭터는 대상에서 빠지므로 다시 실행하면 남은 캐릭터만 본다. */
  async trim(
    reportProgress: (done: number, total: number) => void
  ): Promise<LoweredHistoryTrimSummary> {
    const characters = await this.repository.readCharacters()
    let trimmed = 0

    for (const [index, character] of characters.entries()) {
      if (await this.repository.trim(character)) {
        trimmed++
      }

      const done = index + 1
      if (done % PROGRESS_STEP === 0 || done === characters.length) {
        reportProgress(done, characters.length)
      }
    }

    return { characters: characters.length, trimmed }
  }
}

export function createLoweredHistoryTrimJob(service: LoweredHistoryTrimService) {
  return defineJob({
    name: 'lowered-history-trim',
    displayName: '낮아진 이력 정리',
    description:
      '명성이나 점수가 직전 기록보다 낮게 저장된 시점을 캐릭터 이력에서 지웁니다. 낮아진 관측을 저장하지 않게 되기 전에 쌓인 이력만 바뀌고, Neople은 부르지 않습니다.',
    argsSchema: z.object({}),
    delayMinutes: DELAY_MINUTES,
    neopleApi: null,
    run: (_args, { reportProgress }) => service.trim(reportProgress)
  })
}
