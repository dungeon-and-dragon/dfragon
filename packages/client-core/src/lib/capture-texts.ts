export type CaptureTexts = Readonly<{
  noSource: string
  ocrPreparing: string
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

const RETRY = '다시 캡처하거나 스크린샷을 다시 붙여 넣어 주세요.'
const RECAPTURE = '다시 캡처하거나 다시 찍어 붙여 넣으세요.'

// 웹은 화면 공유와 붙여넣기를 함께 받으므로 다시 인식하는 길을 두 입력 모두로 안내한다.
export const WEB_CAPTURE_TEXTS: CaptureTexts = {
  noSource: '게임 연결로 던파 창을 공유하거나, Alt+PrtSc로 찍어 Ctrl+V로 붙여 넣으세요.',
  ocrPreparing: '글자 인식 모델을 받고 있습니다.',
  ocrPrepareFailed: `글자 인식을 준비하지 못했습니다. ${RETRY}`,
  complete: '인식을 마쳤습니다. 다시 캡처하거나 스크린샷을 붙여 넣으면 새로 인식합니다.',
  disconnected: '화면을 읽지 못했습니다. 게임을 다시 연결하거나 스크린샷을 다시 붙여 넣어 주세요.',
  nextLookupStep: '캡처나 붙여넣기로 다시 인식하거나 서버와 이름을 직접 조회해 주세요.',
  partyStartFailed: `검색을 시작하지 못했습니다. ${RETRY}`,
  partyOcrFailed:
    '글자 인식에 실패했습니다. 캡처나 붙여넣기를 다시 하거나 캐릭터 직접 검색을 사용해 주세요.',
  partyFrameMissing:
    '파티 프레임을 찾지 못했습니다. 던파 창을 공유하거나 Alt+PrtSc로 찍어 붙여 넣으세요.',
  raidStartFailed: `검색을 시작하지 못했습니다. ${RETRY}`,
  raidOcrFailed:
    '글자 인식에 실패했습니다. 캡처나 붙여넣기를 다시 하거나 서버와 이름을 직접 조회해 주세요.',
  raidWindowMissing: `공대 상세 창을 찾지 못했습니다. 12인 공대 상세 창을 연 뒤 ${RECAPTURE}`,
  raidWindowUncertain: `공대 상세 창을 확인하지 못했습니다. 창 하나만 가려지지 않게 연 뒤 ${RECAPTURE}`,
  raidNamesMissing: `공대원 이름을 찾지 못했습니다. 공대 상세 창이 가려지지 않게 한 뒤 ${RECAPTURE}`
}
