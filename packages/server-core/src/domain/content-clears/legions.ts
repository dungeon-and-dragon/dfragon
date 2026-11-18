export type ClearLegion = {
  id: string
  name: string
  releasedAt: Date
}

// 화면에 쓰는 레기온만 둔다. 출시일은 운영 DB의 첫 클리어 날이고 업데이트는 06:00(KST) 초기화에 열린다(2026-11-10).
// name은 타임라인 레기온 클리어 기록의 regionName과 글자까지 같아야 한다.
export const CLEAR_LEGIONS: readonly ClearLegion[] = [
  {
    id: 'legion-apocalypse',
    name: '아포칼립스',
    releasedAt: new Date('2026-04-23T06:00:00+09:00')
  },
  { id: 'legion-venus', name: '베누스', releasedAt: new Date('2025-02-06T06:00:00+09:00') }
]
