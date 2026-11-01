import type { CaptureTexts } from '../../lib/capture-texts'

const PASTE_AGAIN = '스크린샷을 다시 붙여 넣어 주세요.'

export const WEB_CAPTURE_TEXTS: CaptureTexts = {
  noSource: '던파 창을 Alt+PrtSc로 찍은 뒤 이 페이지에 Ctrl+V로 붙여 넣으세요.',
  ocrPreparing: '글자 인식 모델을 받고 있습니다.',
  ocrPrepareFailed: `글자 인식을 준비하지 못했습니다. ${PASTE_AGAIN}`,
  complete: '인식을 마쳤습니다. 다시 인식하려면 스크린샷을 다시 붙여 넣으세요.',
  disconnected: `붙여 넣은 이미지를 읽지 못했습니다. ${PASTE_AGAIN}`,
  nextLookupStep: '스크린샷을 다시 붙여 넣거나 서버와 이름을 직접 조회해 주세요.',
  partyStartFailed: `검색을 시작하지 못했습니다. ${PASTE_AGAIN}`,
  partyOcrFailed:
    '글자 인식에 실패했습니다. 스크린샷을 다시 붙여 넣거나 캐릭터 직접 검색을 사용해 주세요.',
  partyFrameMissing:
    '파티 프레임을 찾지 못했습니다. 던파 창을 Alt+PrtSc로 찍어 다시 붙여 넣으세요.',
  raidStartFailed: `검색을 시작하지 못했습니다. ${PASTE_AGAIN}`,
  raidOcrFailed:
    '글자 인식에 실패했습니다. 스크린샷을 다시 붙여 넣거나 서버와 이름을 직접 조회해 주세요.',
  raidWindowMissing:
    '공대 상세 창을 찾지 못했습니다. 12인 공대 상세 창을 연 뒤 다시 찍어 붙여 넣으세요.',
  raidWindowUncertain:
    '공대 상세 창을 확인하지 못했습니다. 창 하나만 가려지지 않게 연 뒤 다시 찍어 붙여 넣으세요.',
  raidNamesMissing:
    '공대원 이름을 찾지 못했습니다. 공대 상세 창이 가려지지 않게 한 뒤 다시 찍어 붙여 넣으세요.'
}
