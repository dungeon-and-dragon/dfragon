import type { CharacterHistoryBasic } from '@dfragon/database'
import type { CharacterIdentity } from '../character-identity.js'
import {
  type CharacterDetailSection,
  type CharacterPayload,
  type CharacterPayloads,
  characterDetailSections
} from '../character-detail/sections.js'

export type CharacterHistorySection = Exclude<CharacterDetailSection, 'basic'>

export type CharacterSectionBodies = Record<CharacterHistorySection, CharacterPayload>

const historySections = characterDetailSections.filter(
  (section): section is CharacterHistorySection => section !== 'basic'
)

// Neople은 섹션마다 기본 정보 섹션과 같은 캐릭터 헤더를 붙인다. 헤더를 남기면 명성만 바뀌어도 모든 섹션이 바뀐 것으로 보인다.
export function stripCharacterHeader(
  header: CharacterPayload,
  section: CharacterPayload
): CharacterPayload {
  return Object.fromEntries(Object.entries(section).filter(([key]) => !Object.hasOwn(header, key)))
}

export function restoreCharacterHeader(
  header: CharacterPayload,
  body: CharacterPayload
): CharacterPayload {
  return { ...header, ...body }
}

export function toSectionBodies(payloads: CharacterPayloads): CharacterSectionBodies {
  const bodies = historySections.map((section) => {
    const body = stripCharacterHeader(payloads.basic, payloads[section])

    return [section, body] as const
  })

  return Object.fromEntries(bodies) as CharacterSectionBodies
}

// Neople 기본 정보 섹션과 같은 key 순서다. 받을 때 빠졌던 길드, 명성은 null로 붙지만 상세 투영은 둘을 같게 본다.
export function toCharacterHeader(
  { serverId, characterId }: CharacterIdentity,
  basic: CharacterHistoryBasic
): CharacterPayload {
  return {
    serverId,
    characterId,
    characterName: basic.characterName,
    level: basic.level,
    jobId: basic.jobId,
    jobGrowId: basic.jobGrowId,
    jobName: basic.jobName,
    jobGrowName: basic.jobGrowName,
    fame: basic.fame,
    adventureName: basic.adventureName,
    guildId: basic.guildId,
    guildName: basic.guildName
  }
}

export function restoreCharacterPayloads(
  header: CharacterPayload,
  bodies: Readonly<Record<string, CharacterPayload>>
): CharacterPayloads {
  const sections = historySections.map((section) => {
    const restored = restoreCharacterHeader(header, bodies[section] ?? {})

    return [section, restored] as const
  })

  const restoredSections = Object.fromEntries(sections)

  return { basic: header, ...restoredSections } as CharacterPayloads
}
