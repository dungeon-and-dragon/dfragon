export const DIAGNOSTIC_MESSAGES = {
  CAPTURE_START_FAILED: '캡처를 시작하지 못했습니다.',
  CAPTURE_READ_FAILED: '캡처 프레임을 읽지 못했습니다.',
  OCR_FAILED: '닉네임 인식을 완료하지 못했습니다.',
  SEARCH_FAILED: '캐릭터 조회를 완료하지 못했습니다.',
  SEARCH_TIMEOUT: '캐릭터 조회 시간이 초과되었습니다.',
  SEARCH_RESPONSE_INVALID: '캐릭터 조회 응답을 확인하지 못했습니다.',
  SEARCH_UNAVAILABLE: '캐릭터 조회 서비스에 연결하지 못했습니다.',
  SEARCH_APPEARANCE_FALLBACK: '외형을 확인하지 못해 최고 명성 후보를 표시합니다.',
  SEARCH_RAID_ROW_FALLBACK: '공대 행의 직업과 수치를 확인하지 못해 최고 명성 후보를 표시합니다.',
  RENDERER_ERROR: '화면 실행 중 오류가 발생했습니다.',
  RENDERER_REJECTION: '화면의 비동기 작업 중 오류가 발생했습니다.'
} as const

export type DiagnosticCode = keyof typeof DIAGNOSTIC_MESSAGES
