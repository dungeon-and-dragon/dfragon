import type { CollectedCharacter } from '@dfragon/database'
import { type CollectionPace, collectPaced } from '../neople-collection/pace.js'
import { type FetchSkillStyle, type SkillStyleStore, collectSkillStyle } from './collect.js'

const REFRESH_BATCH_SIZE = 100

export interface SkillStylePassDependencies extends CollectionPace {
  fetchSkillStyle: FetchSkillStyle
  store: SkillStyleStore
  report: (code: string) => void
}

export async function runSkillStylePass({
  fetchSkillStyle,
  store,
  report,
  ...pace
}: SkillStylePassDependencies): Promise<'drained' | 'unavailable'> {
  // 실패한 캐릭터는 갱신 시각이 그대로라 다시 뽑히므로, 이번 회차에서는 빼고 다음 회차에 다시 부른다.
  const skipped: CollectedCharacter[] = []
  const collect = async (character: CollectedCharacter) => {
    const result = await collectSkillStyle(character, fetchSkillStyle, store)
    if (result === 'failed') {
      skipped.push(character)
      report('SKILL_STYLE_NEOPLE_FAILED')
    }

    return result
  }
  for (const job of await store.readJobs()) {
    for (;;) {
      const batch = await store.takeBatch(job, skipped, REFRESH_BATCH_SIZE)
      if (batch.length === 0) {
        break
      }

      if ((await collectPaced(batch, collect, pace)) === 'unavailable') {
        report('SKILL_STYLE_NEOPLE_UNAVAILABLE')

        return 'unavailable'
      }
    }
  }

  return 'drained'
}
