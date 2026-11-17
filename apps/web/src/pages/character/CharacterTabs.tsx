import { Tabs } from '@base-ui/react/tabs'
import type { CharacterDetailView } from '#core/character/character-detail-view'
import { CHARACTER_TABS, type CharacterTab, isCharacterTab } from './character-tabs'

const ROOT = 'flex flex-col rounded-panel border border-line bg-canvas'
// 내용이 아직 없는 탭과 받는 중, 오류 상태가 같은 높이를 차지해 패널이 접히지 않게 한다.
const PANEL =
  'min-h-90 rounded-b-panel text-sm outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-signal'

export function CharacterTabs({
  tab,
  detail,
  onTabChange
}: {
  tab: CharacterTab
  detail: CharacterDetailView
  onTabChange: (tab: CharacterTab) => void
}): React.JSX.Element {
  function handleValueChange(value: unknown): void {
    if (isCharacterTab(value)) {
      onTabChange(value)
    }
  }

  return (
    <Tabs.Root value={tab} onValueChange={handleValueChange} className={ROOT}>
      <Tabs.List aria-label="캐릭터 정보" className="tabs shrink-0 px-1 max-sm:overflow-x-auto">
        {CHARACTER_TABS.map(({ id, label }) => (
          <Tabs.Tab key={id} value={id} className="tab">
            {label}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator className="tabs-indicator" />
      </Tabs.List>
      {CHARACTER_TABS.map(({ id, Content }) => (
        <Tabs.Panel key={id} value={id} className={PANEL}>
          <Content detail={detail} />
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  )
}

export function CharacterTabsSkeleton(): React.JSX.Element {
  return (
    <div aria-hidden="true" className={ROOT}>
      <div className="flex h-11 shrink-0 items-center gap-6 overflow-hidden border-b border-line px-4">
        {CHARACTER_TABS.map(({ id }) => (
          <span key={id} className="block h-3.5 w-14 rounded-control bg-inset" />
        ))}
      </div>
      <div className={PANEL} />
    </div>
  )
}
