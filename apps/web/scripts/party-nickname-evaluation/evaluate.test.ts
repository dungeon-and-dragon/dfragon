import { describe, expect, it } from 'vitest'
import {
  type CaseObservation,
  editDistance,
  formatTable,
  scaleBin,
  type SlotObservation,
  summarize
} from './evaluate'
import { parseManifest } from './manifest'

// 합성 닉네임만 쓰며 표본이나 플레이어 식별자는 넣지 않는다.
function slotOf(overrides: Partial<SlotObservation> = {}): SlotObservation {
  return {
    slot: 1,
    expected: '가나다라',
    uncertain: false,
    read: { nickname: '가나다라', raw: '가나다라' },
    ...overrides
  }
}

function caseOf(overrides: Partial<CaseObservation> = {}): CaseObservation {
  return {
    caseId: 'case-01',
    client: { width: 1920, height: 1080 },
    uiPercent: 100,
    capture: 'prtsc',
    scale: 1.8,
    detectionFailure: null,
    slots: [slotOf()],
    ...overrides
  }
}

describe('편집 거리', () => {
  it.each([
    ['kitten', 'sitting', 3],
    ['', '가나', 2],
    ['가나다', '', 3],
    ['가나다라', '가다라', 1],
    ['ABlI', 'AB1l', 2],
    ['𠀀가', '𠀁가', 1]
  ])('%s와 %s는 code point 단위로 %i만큼 다르다', (expected, actual, distance) => {
    expect(editDistance(expected, actual)).toBe(distance)
  })
})

describe('배율 구간', () => {
  it.each([
    [1, '1.0'],
    [1.09, '1.0'],
    [1.1, '1.1'],
    [1.29, '1.2'],
    [1.8, '1.8'],
    [3.6, '3.6'],
    [null, 'undetected']
  ])('검출 배율 %s는 %s 구간이다', (scale, bin) => {
    expect(scaleBin(scale)).toBe(bin)
  })
})

describe('평가 요약', () => {
  it('CER은 자리별 비율의 평균이 아니라 편집 거리 합을 정답 글자 수 합으로 나눈다', () => {
    const summary = summarize([
      caseOf({
        slots: [
          slotOf({ slot: 1, expected: '가나', read: { nickname: '가', raw: '' } }),
          slotOf({ slot: 2, expected: '가나다라마바', read: { nickname: '가나다라마바', raw: '' } })
        ]
      })
    ])

    expect(summary.overall.recognition.nickname).toEqual({
      slots: 2,
      exact: 1,
      editDistance: 1,
      characters: 8,
      cer: 1 / 8
    })
    expect(summary.overall.recognition.raw).toMatchObject({ exact: 0, editDistance: 8, cer: 1 })
  })

  it('불확실한 정답, 읽지 못한 자리, 정답 없는 자리는 채점에서 빼고 따로 센다', () => {
    const summary = summarize([
      caseOf({
        slots: [
          slotOf({ slot: 1 }),
          slotOf({ slot: 2, uncertain: true, read: { nickname: '틀림', raw: '틀림' } }),
          slotOf({ slot: 3, read: null }),
          slotOf({ slot: 4, expected: null, read: { nickname: '아무', raw: '아무' } })
        ]
      })
    ])

    expect(summary.overall).toMatchObject({
      labeledSlots: 3,
      uncertainSlots: 1,
      missingSlots: 1,
      recognition: { nickname: { slots: 1, exact: 1, cer: 0 } }
    })
  })

  it('client와 UI 크기, 0.1 배율 구간, 캡처 종류로 나누고 검출 실패는 따로 모은다', () => {
    const summary = summarize([
      caseOf({ caseId: 'a', scale: 1.8 }),
      caseOf({
        caseId: 'b',
        scale: 1.85,
        capture: 'share',
        slots: [slotOf({ read: { nickname: '가나다', raw: '가나다라' } })]
      }),
      caseOf({
        caseId: 'c',
        client: { width: 1067, height: 600 },
        uiPercent: null,
        capture: 'ingame-jpg',
        scale: null,
        detectionFailure: 'no-anchor',
        slots: [slotOf({ read: null })]
      })
    ])

    expect(Object.keys(summary.byClientUi)).toEqual(['1067x600 ui?', '1920x1080 ui100'])
    expect(summary.byScale['1.8']).toMatchObject({
      cases: 2,
      detectedCases: 2,
      recognition: { nickname: { slots: 2, exact: 1 }, raw: { slots: 2, exact: 2 } }
    })
    expect(summary.byScale.undetected).toMatchObject({
      cases: 1,
      detectedCases: 0,
      missingSlots: 1,
      recognition: { nickname: { slots: 0, cer: null } }
    })
    expect(Object.keys(summary.byCapture)).toEqual(['ingame-jpg', 'prtsc', 'share'])
  })

  it('표는 구간마다 두 전처리의 일치 수와 CER을 한 행에 쓴다', () => {
    const summary = summarize([
      caseOf({ slots: [slotOf({ expected: '가나', read: { nickname: '가나', raw: '가' } })] })
    ])

    expect(formatTable('s 구간', summary.byScale).split('\n')[2]).toBe(
      '| 1.8 | 1 | 1 | 1 | 0 | 0 | 1/1 | 0.000 | 0/1 | 0.500 |'
    )
  })
})

describe('manifest', () => {
  const entry = {
    id: 'case-01',
    image: 'case-01.png',
    client: { width: 1920, height: 1080 },
    uiPercent: null,
    capture: 'ingame-jpg',
    slots: [
      { slot: 1, text: '가나', uncertain: true },
      { slot: 2, text: '다라' }
    ]
  }

  it('UI 크기를 모르는 표본과 정답 확신 표시를 읽는다', () => {
    expect(parseManifest('/samples', { cases: [entry] }).cases[0]).toEqual({
      ...entry,
      slots: [
        { slot: 1, text: '가나', uncertain: true },
        { slot: 2, text: '다라', uncertain: false }
      ]
    })
  })

  it.each([
    ['PNG가 아닌 이미지', { image: 'case-01.jpg' }, 'PNG'],
    ['절대 경로', { image: '/case-01.png' }, '상대 경로'],
    ['알 수 없는 캡처 종류', { capture: 'clipboard' }, 'capture'],
    ['범위 밖 UI 크기', { uiPercent: 125 }, 'uiPercent'],
    ['없는 자리 번호', { slots: [{ slot: 5, text: '가' }] }, 'slot'],
    [
      '중복 자리',
      {
        slots: [
          { slot: 1, text: '가' },
          { slot: 1, text: '나' }
        ]
      },
      '중복'
    ]
  ])('%s는 거절한다', (_, overrides, message) => {
    expect(() => parseManifest('/samples', { cases: [{ ...entry, ...overrides }] })).toThrow(
      message
    )
  })
})
