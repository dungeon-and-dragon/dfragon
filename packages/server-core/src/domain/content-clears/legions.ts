import { LEGION_CLEAR_CODE } from '#domain/character-timeline/index.js'
import type { ClearContent } from './contents.js'

// 화면에 쓰는 레기온만 둔다. 출시일은 운영 DB의 첫 클리어 날이고 업데이트는 06:00(KST) 초기화에 열린다(2026-11-10).
// 이름은 타임라인 레기온 클리어 기록의 regionName과 글자까지 같아야 한다. 입장 명성은 게임의 레기온 입장 명성이다(2026-11-25).
export const CLEAR_LEGIONS: readonly ClearContent[] = [
  {
    id: 'legion-apocalypse',
    kind: 'legion',
    name: '아포칼립스',
    releasedAt: new Date('2026-04-23T06:00:00+09:00'),
    entryFame: 73_993,
    rule: { type: 'clear', codes: [LEGION_CLEAR_CODE], name: '아포칼립스', stage: null }
  },
  {
    id: 'legion-venus',
    kind: 'legion',
    name: '베누스',
    releasedAt: new Date('2025-02-06T06:00:00+09:00'),
    entryFame: 41_929,
    rule: { type: 'clear', codes: [LEGION_CLEAR_CODE], name: '베누스', stage: null }
  }
]
