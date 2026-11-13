import type { NeopleClient } from '@dfragon/neople'
import type { CreateClearTimeline } from '../../application/content-clears/ports.js'
import { CLEAR_CODES } from '../../domain/character-timeline/project.js'
import { CLEAR_CONTENTS } from '../../domain/content-clears/contents.js'
import { createNeopleCharacterTimeline } from './character-timeline.js'

const sortCodes = (codes: readonly number[]) =>
  [...new Set(codes)].sort((left, right) => left - right)

// 레이드, 레기온 기록은 집계 대상 목록과 상관없이 모두 저장하므로 늘 받는다.
const CLEAR_TIMELINE_CODES = sortCodes([
  ...CLEAR_CODES,
  ...CLEAR_CONTENTS.flatMap(({ rule }) => (rule.type === 'clear' ? rule.codes : [rule.code]))
])
const CLEAR_RECORD_TIMELINE_CODES = sortCodes(CLEAR_CODES)

function createCountedTimeline(
  neople: Pick<NeopleClient, 'characterTimeline'>,
  codes: readonly number[]
): CreateClearTimeline {
  return (onRequest) =>
    createNeopleCharacterTimeline(
      {
        characterTimeline: (identity, query) => {
          onRequest()

          return neople.characterTimeline(identity, query)
        }
      },
      codes
    )
}

export function createNeopleClearTimeline(
  neople: Pick<NeopleClient, 'characterTimeline'>
): CreateClearTimeline {
  return createCountedTimeline(neople, CLEAR_TIMELINE_CODES)
}

export function createNeopleClearRecordTimeline(
  neople: Pick<NeopleClient, 'characterTimeline'>
): CreateClearTimeline {
  return createCountedTimeline(neople, CLEAR_RECORD_TIMELINE_CODES)
}
