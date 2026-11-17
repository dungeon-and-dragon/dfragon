// 공용 Tooltip은 signal(본문과 반대 모드의 바탕)이라, 게임 색과 보조 글자를 담는 내용은 반대 모드 토큰으로 그려야 바탕과 읽힌다.
export const INVERSE_SCHEME =
  'scheme-dark dark:scheme-light [:root[data-color-mode=dark]_&]:scheme-light [:root[data-color-mode=light]_&]:scheme-dark'
