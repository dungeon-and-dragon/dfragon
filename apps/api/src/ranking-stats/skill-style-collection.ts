import { setTimeout } from 'node:timers/promises'
import {
  type CharacterSkillStyleInput,
  type DatabaseClient,
  type SkillStyleSampleCharacter,
  readSampleCharactersWithoutSkillStyle,
  recordCharacterSkillStyle
} from '@dfragon/database'
import {
  type NeopleCharacterSkillStyle,
  type NeopleClient,
  NeopleRequestFailure
} from '@dfragon/neople'
import { z } from 'zod'
import { defineJob } from '../jobs/definition.js'

export const UNAVAILABLE_PAUSE_MS = 60_000

// 운영 표본 35.5만 명(2026-11-10)을 초당 40건으로 처음부터 채우면 2시간 반이 걸린다.
// 다른 수집과 Neople 요청을 나눠 보내므로 두 배 넘게 둔다.
const DELAY_MINUTES = 6 * 60

export type SkillStyleCollectionStore = {
  readTargets(): Promise<SkillStyleSampleCharacter[]>
  recordSkillStyle(style: CharacterSkillStyleInput): Promise<void>
}

export type SkillStyleCollectionJobDependencies = {
  neople: Pick<NeopleClient, 'characterSkillStyle'>
  concurrency: number
  report: (code: string, details: Readonly<Record<string, string | number>>) => void
}

export type SkillStyleCollectionDependencies = SkillStyleCollectionJobDependencies & {
  store: SkillStyleCollectionStore
  now: () => Date
  pause: (ms: number) => Promise<void>
  reportProgress: (done: number, total: number) => void
}

export type SkillStyleCollectionSummary = {
  characters: number
  saved: number
  skipped: number
}

type FetchedSkillStyle =
  | { status: 'fetched'; style: CharacterSkillStyleInput }
  | { status: 'skipped' }
  | { status: 'unavailable' }

export function createDatabaseSkillStyleCollectionStore(
  client: DatabaseClient
): SkillStyleCollectionStore {
  return {
    readTargets: () => readSampleCharactersWithoutSkillStyle(client),
    recordSkillStyle: (style) => recordCharacterSkillStyle(client, style)
  }
}

async function fetchSkillStyle(
  character: SkillStyleSampleCharacter,
  { neople, now }: Pick<SkillStyleCollectionDependencies, 'neople' | 'now'>
): Promise<FetchedSkillStyle> {
  let style: NeopleCharacterSkillStyle
  try {
    style = await neople.characterSkillStyle(character)
  } catch (error) {
    if (!(error instanceof NeopleRequestFailure)) {
      throw error
    }

    // 한도 초과, 점검, timeout은 캐릭터 문제가 아니라 쉬었다가 같은 캐릭터를 다시 부른다.
    if (error.kind === 'unavailable' || error.kind === 'timeout') {
      return { status: 'unavailable' }
    }

    return { status: 'skipped' }
  }

  const fetchedStyle: CharacterSkillStyleInput = { ...character, ...style, fetchedAt: now() }

  return { status: 'fetched', style: fetchedStyle }
}

/** 저장한 캐릭터는 다음 실행의 대상에서 빠지므로, 도중에 끝난 수집은 다시 실행하면 남은 캐릭터부터 받는다. */
export async function collectSkillStyles({
  store,
  neople,
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
    const results = await Promise.all(
      group.map((character) => fetchSkillStyle(character, { neople, now }))
    )
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
