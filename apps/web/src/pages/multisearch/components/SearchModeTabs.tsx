import { Tabs } from '@base-ui/react/tabs'
import { useSearchModeStore, type SearchMode } from '#features/capture-search'

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
    <Tabs.Root
      value={searchMode}
      onValueChange={handleValueChange}
      className="flex shrink-0 self-stretch"
    >
      <Tabs.List aria-label="화면" className="relative flex items-stretch">
        {SEARCH_MODES.map((mode) => (
          <Tabs.Tab key={mode} value={mode} className="tab h-auto">
            {SEARCH_MODE_LABELS[mode]}
          </Tabs.Tab>
        ))}
        {/* 상단 바 표시 막대(useIndicatorSlide)와 같은 길이와 곡선으로 미끄러진다. */}
        <Tabs.Indicator className="absolute -bottom-px left-(--active-tab-left) h-[2px] w-(--active-tab-width) bg-signal transition-[left,width] duration-380 ease-standard motion-reduce:duration-0" />
      </Tabs.List>
    </Tabs.Root>
  )
}
