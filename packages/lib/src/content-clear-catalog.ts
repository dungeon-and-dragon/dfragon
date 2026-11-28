export type ClearContentCatalogEntry = {
  id: string
  kind: 'raid' | 'challenge' | 'legion'
  name: string
}

// 운영 app은 점수 엔진을 싣는 server-core를 쓰지 않아 운영 화면에 보일 클리어 컨텐츠 목록을 여기 둔다.
// server-core의 컨텐츠 목록과 같은지는 server-core 테스트가 확인한다.
export const CLEAR_CONTENT_CATALOG: readonly ClearContentCatalogEntry[] = [
  { id: 'nabel-normal', kind: 'raid', name: '만들어진 신 나벨 (일반)' },
  { id: 'nabel-hard', kind: 'raid', name: '만들어진 신 나벨 (하드)' },
  { id: 'inae-twilight', kind: 'raid', name: '이내 황혼전' },
  { id: 'diregie-normal', kind: 'raid', name: '디레지에 레이드 (일반)' },
  { id: 'diregie-hard', kind: 'raid', name: '디레지에 레이드 (하드)' },
  { id: 'michaela-normal', kind: 'raid', name: '무너진 성자 미카엘라 (일반)' },
  { id: 'michaela-hard', kind: 'raid', name: '무너진 성자 미카엘라 (하드)' },
  { id: 'engraved-nightmare-1', kind: 'challenge', name: '각인된 악몽 "죽음을 딛고 선 자"' },
  { id: 'legion-apocalypse', kind: 'legion', name: '아포칼립스' },
  { id: 'legion-venus', kind: 'legion', name: '베누스' }
]
