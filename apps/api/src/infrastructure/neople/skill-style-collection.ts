import type { CharacterSkillStyleInput, SkillStyleSampleCharacter } from '@dfragon/database'
import {
  type NeopleCharacterSkillStyle,
  type NeopleClient,
  NeopleRequestFailure
} from '@dfragon/neople'
import type { FetchedSkillStyle, FetchSkillStyle } from '../../application/ranking-stats/ports.js'

async function fetchSkillStyle(
  character: SkillStyleSampleCharacter,
  neople: Pick<NeopleClient, 'characterSkillStyle'>,
  now: () => Date
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

export function createNeopleSkillStyle(
  neople: Pick<NeopleClient, 'characterSkillStyle'>
): FetchSkillStyle {
  return (character, now) => fetchSkillStyle(character, neople, now)
}
