import { Tabs as BaseTabs } from '@base-ui/react/tabs'
import type { ComponentType } from 'react'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'

export type TabsListProps = PublicProps<typeof BaseTabs.List>

function TabsListImpl({ children, className, style, ...props }: TabsListProps & ForwardedStyle) {
  return (
    <BaseTabs.List {...props} {...withForwardedStyle({ className: 'tabs' }, { className, style })}>
      {children}
      <BaseTabs.Indicator className="tabs-indicator" />
    </BaseTabs.List>
  )
}

const TabsList: ComponentType<TabsListProps> = TabsListImpl

export type TabsTabProps = PublicProps<typeof BaseTabs.Tab>

function TabsTabImpl({ className, style, ...props }: TabsTabProps & ForwardedStyle) {
  return (
    <BaseTabs.Tab {...props} {...withForwardedStyle({ className: 'tab' }, { className, style })} />
  )
}

const TabsTab: ComponentType<TabsTabProps> = TabsTabImpl

export const Tabs = {
  Root: BaseTabs.Root,
  List: TabsList,
  Tab: TabsTab,
  Panel: BaseTabs.Panel
}
