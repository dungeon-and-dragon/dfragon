import { Tabs } from '@base-ui/react/tabs'
import * as stylex from '@stylexjs/stylex'
import type { CharacterDetailView } from '#core/shared/search/character-detail-view'
import { CHARACTER_TABS, type CharacterTab, isCharacterTab } from './character-tabs'
import { styles } from './CharacterTabs.style'

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
    <Tabs.Root value={tab} onValueChange={handleValueChange} {...stylex.props(styles.root)}>
      <Tabs.List aria-label="캐릭터 정보" {...stylex.props(styles.list)}>
        {CHARACTER_TABS.map(({ id, label }) => (
          <Tabs.Tab key={id} value={id} {...stylex.props(styles.tab)}>
            {label}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator {...stylex.props(styles.indicator)} />
      </Tabs.List>
      {CHARACTER_TABS.map(({ id, Content }) => (
        <Tabs.Panel key={id} value={id} {...stylex.props(styles.panel)}>
          <Content detail={detail} />
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  )
}

export function CharacterTabsSkeleton(): React.JSX.Element {
  return (
    <div aria-hidden="true" {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.list, styles.skeletonList)}>
        {CHARACTER_TABS.map(({ id }) => (
          <span key={id} {...stylex.props(styles.bone)} />
        ))}
      </div>
      <div {...stylex.props(styles.panel)} />
    </div>
  )
}
