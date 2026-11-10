import assert from 'node:assert/strict'
import test from 'node:test'
import type { TimelineRow } from '../src/domain/character-timeline/rows.js'
import {
  CLEAR_CONTENTS,
  type ClearContent,
  findContentClear,
  toCollectionMinFame,
  toContentClearInput,
  toLatestContents,
  toPopulationMinFame
} from '../src/content-clears/contents.js'

// 합성 타임라인 기록이다. data는 운영 DB에서 본 Neople 응답의 필드 모양을 따른다.
const at = (time: string) => new Date(`${time}+09:00`)
const raidRow = (code: number, data: Record<string, unknown>): TimelineRow => ({
  code,
  occurredAt: at('2026-11-07T21:15:00'),
  name: code === 210 ? '레이드(선발대)' : '레이드',
  data: { raidPartyName: '합성 공격대', ...data }
})
const boxRow = (itemId: string, itemName: string): TimelineRow => ({
  code: 504,
  occurredAt: at('2026-11-06T23:59:00'),
  name: '아이템 획득(항아리&상자)',
  data: { itemId, itemName, itemRarity: '레전더리', channelName: '합성 채널', channelNo: 7 }
})
const NIGHTMARE_TITLE_ID = '070577c19e70e3ea723bbc924b111a12'
const michaela = (modeName: string, extra: Record<string, unknown> = {}) => ({
  raidName: '무너진 성자 미카엘라',
  modeName,
  ...extra
})
const diregie = (modeName: string, extra: Record<string, unknown> = {}) => ({
  raidName: '디레지에 레이드',
  modeName,
  ...extra
})
const matchedName = (row: TimelineRow) => findContentClear(row)?.content.name

test('미카엘라 하드 클리어는 code 201과 210 모두 하드 항목, 일반 클리어는 일반 항목이다', () => {
  for (const code of [201, 210]) {
    assert.equal(
      matchedName(raidRow(code, michaela('미카엘라 : 종언서(하드)', { hard: true }))),
      '무너진 성자 미카엘라 (하드)'
    )
    assert.equal(
      matchedName(raidRow(code, michaela('미카엘라 : 종언서'))),
      '무너진 성자 미카엘라 (일반)'
    )
  }
})

test('싱글/매칭 단계와 목록에 없는 레이드, 레이드가 아닌 code의 기록은 어느 항목에도 맞지 않는다', () => {
  assert.equal(findContentClear(raidRow(201, michaela('미카엘라 : 균열서'))), undefined)
  assert.equal(findContentClear(raidRow(201, diregie('디레지에 : 서막'))), undefined)
  assert.equal(
    findContentClear(raidRow(201, { raidName: '만들어진 신 나벨', modeName: '무의지의 장벽' })),
    undefined
  )
  assert.equal(
    findContentClear(raidRow(201, { raidName: '아스라한', modeName: '안개의 신', hard: true })),
    undefined
  )
  assert.equal(
    findContentClear({ ...raidRow(209, michaela('미카엘라 : 종언서')), name: '레기온' }),
    undefined
  )
})

test('디레지에 하드 클리어는 하드 항목으로만, 일반 클리어는 일반 항목으로만 판정한다', () => {
  assert.equal(
    findContentClear(raidRow(201, diregie('디레지에 : 악연', { hard: true })))?.content.id,
    'diregie-hard'
  )
  assert.equal(
    findContentClear(raidRow(201, diregie('디레지에 : 종막')))?.content.id,
    'diregie-normal'
  )
})

test('나벨 본 레이드 클리어는 hard에 따라 하드, 일반 항목이다', () => {
  const nabel = (extra: Record<string, unknown>) => ({
    raidName: '만들어진 신 나벨',
    modeName: '무지의 악',
    ...extra
  })

  assert.equal(findContentClear(raidRow(201, nabel({ hard: true })))?.content.id, 'nabel-hard')
  assert.equal(findContentClear(raidRow(201, nabel({})))?.content.id, 'nabel-normal')
})

test('modeName이 없는 이내 황혼전 클리어는 이내 황혼전 항목이다', () => {
  assert.equal(matchedName(raidRow(201, { raidName: '이내 황혼전' })), '이내 황혼전')
})

test('ratio가 있는 기록은 그 배율로, 없는 기록은 배율 없음으로 나온다', () => {
  assert.equal(
    findContentClear(raidRow(201, michaela('미카엘라 : 종언서(하드)', { hard: true, ratio: 500 })))
      ?.ratio,
    500
  )
  assert.equal(
    findContentClear(raidRow(201, michaela('미카엘라 : 종언서(하드)', { hard: true })))?.ratio,
    null
  )
})

test('code 504이고 itemId가 칭호와 같은 기록만 챌린지 항목이다', () => {
  const match = findContentClear(boxRow(NIGHTMARE_TITLE_ID, '황혼의 악연을 끊은 자'))
  assert.equal(match?.content.kind, 'challenge')
  assert.equal(match?.content.name, '각인된 악몽 "죽음을 딛고 선 자"')
  assert.equal(match?.ratio, null)
  assert.equal(findContentClear(boxRow('fixture-item-box', '합성 상자 아이템')), undefined)
  assert.equal(
    findContentClear({ ...boxRow(NIGHTMARE_TITLE_ID, '황혼의 악연을 끊은 자'), code: 505 }),
    undefined
  )
})

test('저장할 클리어 기록은 클리어 시각이 든 초기화 주의 시작을 함께 갖는다', () => {
  const character = { serverId: 'cain', characterId: 'synthetic-character' }
  const beforeReset = {
    ...raidRow(201, michaela('미카엘라 : 종언서')),
    occurredAt: at('2026-11-12T05:59:00')
  }

  assert.deepEqual(toContentClearInput(character, beforeReset), {
    contentId: 'michaela-normal',
    kind: 'raid',
    serverId: 'cain',
    characterId: 'synthetic-character',
    clearedAt: at('2026-11-12T05:59:00'),
    weekStart: at('2026-11-05T06:00:00'),
    ratio: null
  })
  assert.equal(
    toContentClearInput(character, raidRow(201, michaela('미카엘라 : 균열서'))),
    undefined
  )
})

test('종류마다 첫 출시일이 가장 늦은 묶음이 최신이다', () => {
  assert.deepEqual(
    toLatestContents().map(({ id }) => id),
    ['michaela-normal', 'michaela-hard', 'engraved-nightmare-1']
  )
})

test('더 늦게 출시한 항목을 더하면 그 종류의 최신이 바뀌고 다른 종류는 그대로다', () => {
  const newRaid: ClearContent = {
    id: 'synthetic-raid-normal',
    kind: 'raid',
    name: '합성 레이드 (일반)',
    releasedAt: at('2027-01-07T06:00:00'),
    entryFame: 125_000,
    rule: { type: 'clear', codes: [201, 210], name: '합성 레이드', stage: '일반' }
  }
  // 묶음의 첫 출시일로 비교하므로, 기존 레이드에 더 늦게 더한 항목만으로는 그 레이드가 최신이 되지 않는다.
  const lateDiregieMode: ClearContent = {
    id: 'synthetic-diregie-extra',
    kind: 'raid',
    name: '디레지에 레이드 (합성)',
    releasedAt: at('2027-02-04T06:00:00'),
    entryFame: 30_000,
    rule: { type: 'clear', codes: [201, 210], name: '디레지에 레이드', stage: '합성' }
  }

  assert.deepEqual(
    toLatestContents([...CLEAR_CONTENTS, newRaid, lateDiregieMode]).map(({ id }) => id),
    ['engraved-nightmare-1', 'synthetic-raid-normal']
  )
  assert.equal(toCollectionMinFame([...CLEAR_CONTENTS, newRaid, lateDiregieMode]), 119_414)
})

test('수집 하한은 종류별 최신 컨텐츠의 입장 명성 가운데 가장 낮은 미카엘라의 104,292다', () => {
  assert.equal(toCollectionMinFame(), 104_292)
})

test('분모 기준은 입장 명성이 수집 하한보다 높은 각인된 악몽만 입장 명성이고 레이드 7개 항목은 수집 하한이다', () => {
  assert.deepEqual(
    CLEAR_CONTENTS.map((content) => [content.id, toPopulationMinFame(content, 104_292)]),
    [
      ['nabel-normal', 104_292],
      ['nabel-hard', 104_292],
      ['inae-twilight', 104_292],
      ['diregie-normal', 104_292],
      ['diregie-hard', 104_292],
      ['michaela-normal', 104_292],
      ['michaela-hard', 104_292],
      ['engraved-nightmare-1', 119_414]
    ]
  )
})
