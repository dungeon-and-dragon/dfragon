import type { Meta, StoryObj } from '@storybook/react-vite'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { itemDetailHandlers } from '#widgets/item-tooltip/api/item-detail.handlers'
import { labItemsHandlers } from './api/lab-items.handlers'
import { LabEnchantsPage } from './LabEnchantsPage'

const meta = {
  title: 'Screens/실험실 마법부여',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

function Screen(): React.JSX.Element {
  return (
    <StoryFrame>
      <StoryScreen>
        <LabEnchantsPage />
      </StoryScreen>
    </StoryFrame>
  )
}

export const 마법부여: Story = {
  parameters: {
    msw: [
      labItemsHandlers.items,
      labItemsHandlers.currencyIcon,
      labItemsHandlers.itemIcon,
      itemDetailHandlers.detail
    ]
  },
  render: () => <Screen />
}

export const 받는중: Story = {
  parameters: { msw: [labItemsHandlers.loading] },
  render: () => <Screen />
}

export const 받지못함: Story = {
  parameters: { msw: [labItemsHandlers.failure] },
  render: () => <Screen />
}

export const 비었을때: Story = {
  parameters: { msw: [labItemsHandlers.empty] },
  render: () => <Screen />
}
