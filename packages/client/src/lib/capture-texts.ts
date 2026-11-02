export type CaptureTexts = Readonly<{
  noSource: string
  ocrPreparing: string | null
  ocrPrepareFailed: string
  complete: string
  disconnected: string
  nextLookupStep: string
  partyStartFailed: string
  partyOcrFailed: string
  partyFrameMissing: string
  raidStartFailed: string
  raidOcrFailed: string
  raidWindowMissing: string
  raidWindowUncertain: string
  raidNamesMissing: string
}>

export const DESKTOP_CAPTURE_TEXTS: CaptureTexts = {
  noSource: '',
  ocrPreparing: null,
  ocrPrepareFailed: '글자 인식을 준비하지 못했습니다. Alt+R을 눌러 다시 인식해 주세요.',
  complete: '인식을 마쳤습니다. 다시 인식하려면 Alt+R을 누르세요.',
  disconnected: '캡처 연결이 종료되었습니다. 창을 다시 선택해 주세요.',
  nextLookupStep: 'Alt+R로 다시 인식하거나 서버와 이름을 직접 조회해 주세요.',
  partyStartFailed: '검색을 시작하지 못했습니다. 창을 다시 선택해 주세요.',
  partyOcrFailed: '글자 인식에 실패했습니다. Alt+R을 누르거나 캐릭터 직접 검색을 사용해 주세요.',
  partyFrameMissing: '파티 프레임을 찾지 못했습니다. 파티 프레임이 보이게 한 뒤 Alt+R을 누르세요.',
  raidStartFailed: '검색을 시작하지 못했습니다. Alt+R을 눌러 다시 시도해 주세요.',
  raidOcrFailed: '글자 인식에 실패했습니다. Alt+R을 누르거나 서버와 이름을 직접 조회해 주세요.',
  raidWindowMissing: '공대 상세 창을 찾지 못했습니다. 12인 공대 상세 창을 연 뒤 Alt+R을 누르세요.',
  raidWindowUncertain:
    '공대 상세 창을 확인하지 못했습니다. 창 하나만 가려지지 않게 연 뒤 Alt+R을 누르세요.',
  raidNamesMissing:
    '공대원 이름을 찾지 못했습니다. 공대 상세 창이 가려지지 않게 한 뒤 Alt+R을 누르세요.'
}
