import buffer from '../../../../../apps/api/test/fixtures/character-card-buffer.json'
import dealer from '../../../../../apps/api/test/fixtures/character-card-dealer.json'
import {
  type CharacterDetailView,
  characterDetailViewSchema
} from '../../shared/search/character-detail-view'

type Entry = { slotId?: string; [key: string]: unknown }
type Basic = { serverId: string; characterId: string; [key: string]: unknown }
type Buff = { skill: { buff: unknown } }
type Fixture = {
  sections: {
    basic: Basic
    status: { status: unknown; buff: unknown }
    equipment: { equipment: Entry[]; setItemInfo: unknown }
    avatar: { avatar: Entry[] }
    creature: { creature: unknown }
    oath: { oath: unknown }
    mist_assimilation: { mistAssimilation: unknown }
    skill_style: { skill: unknown }
    buff_equipment: Buff
    buff_avatar: Buff
    buff_creature: Buff
  }
  card: unknown
}
export type CharacterDetailBody = {
  character: Basic
  equipment: Fixture['sections']['equipment']
  avatar: Entry[]
  oath: unknown
  [key: string]: unknown
}

const FIXTURES = { dealer, buffer }

// 테스트가 응답을 고쳐 쓰므로 import한 JSON을 그대로 내주지 않고 복사한다.
function readFixture(role: 'dealer' | 'buffer'): Fixture {
  return structuredClone(FIXTURES[role])
}

// API의 상세 응답처럼 Neople 섹션 원문을 응답 키로 옮긴다. sections, freshness 같은 메타데이터는 화면이 읽지 않아 뺀다.
export function characterDetailResponse(role: 'dealer' | 'buffer'): CharacterDetailBody {
  const { sections, card } = readFixture(role)
  const { serverId, characterId, ...basic } = sections.basic

  return {
    character: { serverId, characterId, serverName: '카인', ...basic },
    status: { status: sections.status.status, buff: sections.status.buff },
    equipment: {
      equipment: sections.equipment.equipment,
      setItemInfo: sections.equipment.setItemInfo
    },
    avatar: sections.avatar.avatar,
    creature: sections.creature.creature,
    oath: sections.oath.oath,
    mistAssimilation: sections.mist_assimilation.mistAssimilation,
    skillStyle: sections.skill_style.skill,
    buff: {
      equipment: sections.buff_equipment.skill.buff,
      avatar: sections.buff_avatar.skill.buff,
      creature: sections.buff_creature.skill.buff
    },
    card
  }
}

export function characterDetailFixture(role: 'dealer' | 'buffer'): CharacterDetailView {
  return characterDetailViewSchema.parse(characterDetailResponse(role))
}
