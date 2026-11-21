// 세트 통계 표본이다. top은 고른 직업, 전직, 역할 범위 안의 명성 상위, fame은 미카엘라: 종언서 권장 명성 이상이다.
export const SET_SAMPLES = ['all', 'top', 'fame'] as const
export type SetSample = (typeof SET_SAMPLES)[number]
export const SET_SAMPLE_TOP_COUNT = 500
export const SET_SAMPLE_MIN_FAME = 117014
