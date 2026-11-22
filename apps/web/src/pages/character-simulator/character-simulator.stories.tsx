import type { Meta, StoryObj } from '@storybook/react-vite'
import type { RequestHandler } from 'msw'
import { storyCharacterDetail } from '#pages/character/api/character.fixture'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { simulatorStoryHandlers } from './api/simulation.handlers'
import { CharacterSimulatorScreen } from './CharacterSimulatorScreen'

const meta = {
  title: 'Screens/장비 시뮬레이터',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>
type Role = 'dealer' | 'buffer'
type Handlers = (detail: ReturnType<typeof storyCharacterDetail>) => RequestHandler[]

const WAIT_STEP_MS = 50
const WAIT_LIMIT_MS = 3_000
// 목록이 열린 직후의 클릭은 항목을 고르지 못해, 열림 전환이 끝난 뒤 항목을 누른다.
const OPEN_SETTLE_MS = 400
const STEP_SETTLE_MS = 100

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForElement<Found extends Element>(
  find: () => Found | undefined
): Promise<Found> {
  for (let waited = 0; waited < WAIT_LIMIT_MS; waited += WAIT_STEP_MS) {
    const found = find()

    if (found !== undefined) {
      return found
    }

    await pause(WAIT_STEP_MS)
  }

  throw new Error('화면 요소를 찾지 못했습니다.')
}

// 열린 목록은 Portal로 문서 끝에 그려지므로 canvas가 아니라 문서에서 항목을 찾는다.
async function pick(canvas: HTMLElement, label: string, option: string): Promise<void> {
  const trigger = await waitForElement(
    () => canvas.querySelector<HTMLElement>(`[aria-label="${label}"]`) ?? undefined
  )
  trigger.click()
  await pause(OPEN_SETTLE_MS)
  const item = await waitForElement(() =>
    [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((candidate) =>
      candidate.textContent?.startsWith(option)
    )
  )
  item.click()
}

async function press(canvas: HTMLElement, label: string, times = 1): Promise<void> {
  const control = await waitForElement(
    () => canvas.querySelector<HTMLElement>(`[aria-label="${label}"]`) ?? undefined
  )

  // 누를 때마다 화면이 새 값을 그린 뒤 다음을 눌러야 한 칸씩 쌓인다.
  for (let count = 0; count < times; count++) {
    control.click()
    await pause(STEP_SETTLE_MS)
  }
}

function screenStory(role: Role, handlers: Handlers): Story {
  const detail = storyCharacterDetail(role)
  const { serverId, characterId } = detail.character

  return {
    parameters: { msw: handlers(detail) },
    render: () => (
      <StoryFrame>
        <StoryScreen>
          <CharacterSimulatorScreen serverId={serverId} characterId={characterId} />
        </StoryScreen>
      </StoryFrame>
    )
  }
}

async function changeDealerEquipment({ canvasElement }: { canvasElement: HTMLElement }) {
  await press(canvasElement, '무기 수치 올리기', 2)
  await press(canvasElement, '상의 증폭')
  await press(canvasElement, '상의 수치 올리기', 10)
  await pick(canvasElement, '목걸이 마법부여', '최종 데미지 증가 +2%')
}

export const 딜러: Story = screenStory('dealer', simulatorStoryHandlers.calculated)

export const 값바꿈: Story = {
  ...screenStory('dealer', simulatorStoryHandlers.calculated),
  play: changeDealerEquipment
}

export const 버퍼: Story = screenStory('buffer', simulatorStoryHandlers.calculated)

export const 건너뜀: Story = {
  ...screenStory('dealer', simulatorStoryHandlers.skipped),
  play: changeDealerEquipment
}

export const 엔진없음: Story = screenStory('dealer', simulatorStoryHandlers.noEngine)

export const 받는중: Story = screenStory('dealer', simulatorStoryHandlers.loading)
