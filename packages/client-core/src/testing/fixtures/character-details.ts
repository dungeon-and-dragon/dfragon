import buffer from '../../../../../apps/api/test/fixtures/character-card-buffer.json'
import dealer from '../../../../../apps/api/test/fixtures/character-card-dealer.json'
import {
  type CharacterDetailView,
  characterDetailViewSchema
} from '../../shared/search/character-detail-view'

const FIXTURES = { dealer, buffer }

// API 테스트의 캐릭터 fixture(Neople 섹션 원문)를 상세 응답의 장비, 서약 관련 키로 옮겨 화면 schema로 읽는다. 호출마다
// 새로 읽어 테스트가 결과를 고쳐도 다른 테스트에 남지 않는다.
export function characterDetailFixture(role: keyof typeof FIXTURES): CharacterDetailView {
  const { sections } = FIXTURES[role]

  return characterDetailViewSchema.parse({
    character: { serverName: '카인', ...sections.basic },
    equipment: sections.equipment,
    avatar: sections.avatar.avatar,
    creature: sections.creature.creature,
    oath: sections.oath.oath,
    mistAssimilation: sections.mist_assimilation.mistAssimilation
  })
}
