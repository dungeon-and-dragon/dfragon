import { Tabs } from '@base-ui/react/tabs'
import * as stylex from '@stylexjs/stylex'
import { useSearchModeStore } from '../../../hooks/useSearchModeStore'
import type { SearchMode } from '#core/capture/search-mode'
import { styles } from './SearchModeTabs.style'

const SEARCH_MODES: readonly SearchMode[] = ['party', 'raid']

const SEARCH_MODE_LABELS: Record<SearchMode, string> = {
  party: '파티',
  raid: '공대'
}

function isSearchMode(value: unknown): value is SearchMode {
  return SEARCH_MODES.some((mode) => mode === value)
}

export function SearchModeTabs(): React.JSX.Element {
  const searchMode = useSearchModeStore((state) => state.searchMode)
  const changeSearchMode = useSearchModeStore((state) => state.changeSearchMode)

  function handleValueChange(value: unknown): void {
    if (isSearchMode(value)) {
      changeSearchMode(value)
    }
  }

  return (
    <Tabs.Root value={searchMode} onValueChange={handleValueChange} {...stylex.props(styles.root)}>
      <Tabs.List aria-label="화면" {...stylex.props(styles.list)}>
        {SEARCH_MODES.map((mode) => (
          <Tabs.Tab key={mode} value={mode} {...stylex.props(styles.tab)}>
            {SEARCH_MODE_LABELS[mode]}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator {...stylex.props(styles.indicator)} />
      </Tabs.List>
    </Tabs.Root>
  )
}
