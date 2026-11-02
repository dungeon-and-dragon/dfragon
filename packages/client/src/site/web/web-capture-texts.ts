import type { SearchMode } from '@dfragon/client-core/types/search-mode'

// 회차 문구는 기계를 만들 때 고정되므로, 던파 창을 연결한 동안의 대기와 완료 문구는 칩이 지금 화면의 자동 인식으로 바꿔 보인다.
export const WEB_SCREEN_WATCH_TEXTS: Readonly<
  Record<SearchMode, Readonly<{ waiting: string; complete: string }>>
> = {
  party: {
    waiting: '마을에서 파티 구성이 바뀌면 자동으로 인식합니다.',
    complete: '인식을 마쳤습니다. 마을에서 파티 구성이 바뀌면 자동으로 다시 인식합니다.'
  },
  raid: {
    waiting: '마을에서 공대 상세 창의 구성이 바뀌면 자동으로 인식합니다.',
    complete: '인식을 마쳤습니다. 마을에서 공대 상세 창의 구성이 바뀌면 자동으로 다시 인식합니다.'
  }
}
