import type { SearchMode } from '@dfragon/client-core/types/search-mode'

export const MAIN_WINDOW_WIDTH = 1080

export const MAIN_WINDOW_HEIGHTS: Record<SearchMode, number> = {
  party: 207,
  raid: 344
}
