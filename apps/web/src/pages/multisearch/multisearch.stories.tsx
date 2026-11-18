import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { PARTY_SEAT_LAYOUT, RAID_SEAT_LAYOUT } from '#core/capture/cards'
import { WEB_CAPTURE_TEXTS } from '#core/capture/capture-texts'
import type { SearchMode } from '#core/capture/search-mode'
import { createSeatOrder, swapSeats } from '#core/capture/seats'
import type { SlotCard, SlotCardActions } from '#core/capture/slot-cards'
import { ScreenCaptureProvider } from '../../components/ScreenCaptureProvider'
import { useSearchModeStore } from '../../hooks/useSearchModeStore'
import type { SeatArrangement } from '../../hooks/useSeatOrder'
import { StoryFrame } from '../../testing/story-support/StoryFrame'
import { StoryScreen } from '../../testing/story-support/StoryScreen'
import {
  createStoryMultisearchHost,
  storyPartyCards,
  storyRaidCards
} from '../../testing/story-support/story-multisearch'
import { PartyScreen } from '../party/PartyScreen'
import { RaidScreen } from '../raid/RaidScreen'
import { MultisearchBoard } from './MultisearchPage'

const meta = {
  title: 'Screens/멀티서치',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

const actions: SlotCardActions = {
  lookupSlot: () => {},
  pickCandidate: () => {},
  changeSnapshotAdventure: () => {}
}

function useStorySeats(mode: SearchMode): SeatArrangement {
  const layout = mode === 'party' ? PARTY_SEAT_LAYOUT : RAID_SEAT_LAYOUT
  const [seatOrder, setSeatOrder] = useState(() => createSeatOrder(layout))

  function swap(from: number, to: number): boolean {
    setSeatOrder((order) => swapSeats(order, from, to))

    return true
  }

  return { layout, seatOrder, canMoveSeats: true, swapSeats: swap }
}

function Frame({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <StoryScreen>
      <div className="section">
        <div className="overflow-x-auto">
          <div className="min-w-[1078px]">{children}</div>
        </div>
      </div>
    </StoryScreen>
  )
}

// 검색 결과는 화면 공유로 회차를 돌려야 생기므로, 결과가 채워진 표는 화면의 행 값을 바로 넘겨 그린다.
function FilledSeats({
  mode,
  cards
}: {
  mode: SearchMode
  cards: readonly SlotCard[]
}): React.JSX.Element {
  const seats = useStorySeats(mode)
  const Screen = mode === 'party' ? PartyScreen : RaidScreen

  return (
    <StoryFrame>
      <Frame>
        <Screen resetKey="story" slots={cards} seats={seats} actions={actions} />
      </Frame>
    </StoryFrame>
  )
}

function Board({ mode }: { mode: SearchMode }): React.JSX.Element {
  // 화면 방식은 전역 store가 가지므로 story를 고를 때마다 그 story의 방식으로 맞춘 뒤 그린다.
  const [host] = useState(() => {
    useSearchModeStore.getState().changeSearchMode(mode)

    return createStoryMultisearchHost()
  })

  return (
    <StoryFrame host={host}>
      <ScreenCaptureProvider texts={WEB_CAPTURE_TEXTS}>
        <StoryScreen>
          <MultisearchBoard host={host} />
        </StoryScreen>
      </ScreenCaptureProvider>
    </StoryFrame>
  )
}

export const 파티: Story = {
  render: () => <Board mode="party" />
}

export const 파티검색결과: Story = {
  render: () => <FilledSeats mode="party" cards={storyPartyCards} />
}

export const 공대: Story = {
  render: () => <Board mode="raid" />
}

export const 공대검색결과: Story = {
  render: () => <FilledSeats mode="raid" cards={storyRaidCards} />
}
