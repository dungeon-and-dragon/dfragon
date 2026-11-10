import type { NeopleClient } from '@dfragon/neople'
import type { CreateClearTimeline } from '../../application/content-clears/ports.js'
import { CLEAR_CONTENTS } from '../../domain/content-clears/contents.js'
import { createNeopleCharacterTimeline } from './character-timeline.js'

const CLEAR_TIMELINE_CODES = [
  ...new Set(
    CLEAR_CONTENTS.flatMap(({ rule }) => (rule.type === 'clear' ? rule.codes : [rule.code]))
  )
].sort((left, right) => left - right)

export function createNeopleClearTimeline(
  neople: Pick<NeopleClient, 'characterTimeline'>
): CreateClearTimeline {
  return (onRequest) =>
    createNeopleCharacterTimeline(
      {
        characterTimeline: (identity, query) => {
          onRequest()

          return neople.characterTimeline(identity, query)
        }
      },
      CLEAR_TIMELINE_CODES
    )
}
