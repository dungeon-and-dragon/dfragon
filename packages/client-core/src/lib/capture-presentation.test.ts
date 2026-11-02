import { describe, expect, it } from 'vitest'
import { getCaptureControlState, getTopBarCaptureControls } from './capture-presentation'
import { DESKTOP_CAPTURE_TEXTS } from './capture-texts'

describe('getCaptureControlState', () => {
  it.each([
    ['준비 중', { phase: 'selecting', connected: true }, 'neutral', false],
    ['인식 중', { phase: 'recognizing', connected: false }, 'signal', true],
    ['인식 완료', { phase: 'complete', connected: false }, 'signal', false],
    ['확인 필요', { phase: 'unavailable', connected: true }, 'warning', false],
    ['캡처 실패', { phase: 'failed', connected: true }, 'danger', false],
    ['게임 연결됨', { phase: 'selected', connected: true }, 'success', false],
    ['게임 연결', { phase: 'idle', connected: false }, 'warning', false]
  ] as const)(
    '%s 상태를 우선순위대로 고르고 상태 칩 tone과 진행 표시를 함께 정한다',
    (label, input, tone, busy) => {
      expect(getCaptureControlState(input)).toEqual({ label, tone, busy })
    }
  )
})

describe('getTopBarCaptureControls', () => {
  const input = {
    ocrReady: true,
    texts: DESKTOP_CAPTURE_TEXTS,
    party: {
      phase: 'selected',
      status: '파티 문구',
      sourceReady: true,
      selectedSourceId: 'window:1',
      connectionFailed: false
    },
    raid: { phase: 'recognizing', status: '공대 문구' }
  } as const

  it('같은 입력에서 보이는 화면에 따라 파티 또는 공대 회차의 단계와 문구를 고른다', () => {
    expect(getTopBarCaptureControls({ ...input, isRaidMode: false })).toEqual({
      phase: 'selected',
      status: '파티 문구'
    })
    expect(getTopBarCaptureControls({ ...input, isRaidMode: true })).toEqual({
      phase: 'recognizing',
      status: '공대 문구'
    })
  })

  it('캡처 연결 실패 문구가 회차 문구보다 우선하고 단계는 화면의 단계를 둔다', () => {
    const failed = {
      ...input,
      party: { ...input.party, connectionFailed: true }
    }

    expect(getTopBarCaptureControls({ ...failed, isRaidMode: true })).toEqual({
      phase: 'recognizing',
      status: '캡처 연결을 확인하지 못했습니다. 앱 화면을 다시 열어 주세요.'
    })
    expect(
      getTopBarCaptureControls({
        ...failed,
        isRaidMode: false,
        party: { ...failed.party, selectedSourceId: '' }
      })
    ).toEqual({
      phase: 'selected',
      status: '캡처 연결을 확인하지 못했습니다. 앱 화면을 다시 열어 주세요.'
    })
  })

  it('게임 창을 고르기 전에는 창 없음 문구를 보인다', () => {
    const unselected = {
      ...input,
      texts: { ...DESKTOP_CAPTURE_TEXTS, noSource: '붙여 넣으세요' },
      party: { ...input.party, phase: 'idle', status: '창을 고르세요', selectedSourceId: '' }
    } as const

    expect(getTopBarCaptureControls({ ...unselected, isRaidMode: false })).toEqual({
      phase: 'idle',
      status: '붙여 넣으세요'
    })
    expect(
      getTopBarCaptureControls({ ...unselected, isRaidMode: false, texts: DESKTOP_CAPTURE_TEXTS })
    ).toEqual({ phase: 'idle', status: '' })
    expect(
      getTopBarCaptureControls({
        ...unselected,
        isRaidMode: true,
        party: { ...unselected.party, sourceReady: false },
        raid: { phase: 'idle', status: '공대 대기' }
      })
    ).toEqual({ phase: 'idle', status: '붙여 넣으세요' })
  })

  it('창을 고르지 않고 붙여 넣은 회차는 파티와 공대 모두 그 회차의 단계와 문구를 보인다', () => {
    const pasted = {
      ...input,
      party: {
        ...input.party,
        phase: 'recognizing',
        status: '파티 인식 중',
        sourceReady: false,
        selectedSourceId: ''
      }
    } as const

    expect(getTopBarCaptureControls({ ...pasted, isRaidMode: false })).toEqual({
      phase: 'recognizing',
      status: '파티 인식 중'
    })
    expect(
      getTopBarCaptureControls({
        ...pasted,
        isRaidMode: true,
        raid: { phase: 'complete', status: '공대 완료' }
      })
    ).toEqual({ phase: 'complete', status: '공대 완료' })
  })

  it('창을 고른 뒤의 중지, 창 변경은 끝난 공대 회차보다 먼저 파티 문구를 보인다', () => {
    const stopped = {
      ...input,
      isRaidMode: true,
      party: { ...input.party, phase: 'idle', status: '캡처를 중지했습니다.', sourceReady: false },
      raid: { phase: 'complete', status: '공대 완료' }
    } as const

    expect(getTopBarCaptureControls(stopped)).toEqual({
      phase: 'idle',
      status: '캡처를 중지했습니다.'
    })
    expect(
      getTopBarCaptureControls({
        ...stopped,
        party: { ...stopped.party, phase: 'selecting', status: '창 확인 중' }
      })
    ).toEqual({ phase: 'selecting', status: '창 확인 중' })
  })

  it('OCR 준비 문구가 있으면 worker가 준비되기 전의 인식 단계에서 그 문구를 보인다', () => {
    const preparing = {
      ...input,
      ocrReady: false,
      texts: { ...DESKTOP_CAPTURE_TEXTS, ocrPreparing: '모델 받는 중' },
      party: { ...input.party, phase: 'recognizing', status: '파티 인식 중' }
    } as const

    expect(getTopBarCaptureControls({ ...preparing, isRaidMode: false })).toEqual({
      phase: 'recognizing',
      status: '모델 받는 중'
    })
    expect(getTopBarCaptureControls({ ...preparing, isRaidMode: true })).toEqual({
      phase: 'recognizing',
      status: '모델 받는 중'
    })
    expect(
      getTopBarCaptureControls({ ...preparing, isRaidMode: false, texts: DESKTOP_CAPTURE_TEXTS })
    ).toEqual({ phase: 'recognizing', status: '파티 인식 중' })
  })

  it('공대 화면에서 창이 준비됐고 공대 회차 전이면 단계를 selected로 둔다', () => {
    expect(
      getTopBarCaptureControls({
        ...input,
        isRaidMode: true,
        party: { ...input.party, phase: 'idle' },
        raid: { phase: 'idle', status: '' }
      })
    ).toEqual({ phase: 'selected', status: '' })
  })

  it('공대 회차가 실패로 끝나면 파티 캡처와 같은 실패 단계와 문구를 상태 칩에 넘긴다', () => {
    const controls = getTopBarCaptureControls({
      ...input,
      isRaidMode: true,
      raid: { phase: 'failed', status: '공대원창을 읽지 못했습니다.' }
    })

    expect(controls).toEqual({ phase: 'failed', status: '공대원창을 읽지 못했습니다.' })
    expect(getCaptureControlState({ phase: controls.phase, connected: true }).tone).toBe('danger')
  })
})
