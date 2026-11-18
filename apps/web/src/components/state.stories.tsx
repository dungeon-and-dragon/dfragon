import type { Meta, StoryObj } from '@storybook/react-vite'
import { ClipboardCopyButton } from './ClipboardCopyButton'
import { LoadingLine } from './LoadingLine'
import { ListBox } from './table/ListBox'

const meta = {
  title: 'Patterns/상태',
  decorators: [
    (Story) => (
      <main className="page screen bg-canvas font-sans text-sm text-fg">
        <Story />
      </main>
    )
  ]
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const 빈상태: Story = {
  render: () => (
    <ListBox name="즐겨찾기한 캐릭터">
      <p className="state">즐겨찾기한 캐릭터가 없습니다.</p>
    </ListBox>
  )
}

export const 오류: Story = {
  render: () => (
    <ListBox name="명성 랭킹">
      <p role="alert" className="state state-error">
        랭킹을 받지 못했습니다.
      </p>
    </ListBox>
  )
}

export const 받는중: Story = {
  render: () => (
    <ListBox name="타임라인">
      <div aria-busy="true" className="state state-pending">
        <LoadingLine />
        <span role="status">타임라인을 받는 중입니다.</span>
      </div>
    </ListBox>
  )
}

export const 목록끝: Story = {
  render: () => (
    <ListBox name="강화, 증폭, 재련">
      <div className="state state-pending min-h-12 flex-row border-t border-line py-0">
        <LoadingLine short />
        <span role="status">기록을 더 받는 중입니다.</span>
      </div>
      <div className="state state-error min-h-12 flex-row border-t border-line py-0">
        <p role="alert" className="m-0">
          기록을 더 받지 못했습니다.
        </p>
        <button type="button" className="btn btn-secondary btn-sm">
          다시 시도
        </button>
      </div>
    </ListBox>
  )
}

function stubClipboard(writeText: () => Promise<void>): () => void {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })

  return () => {
    if (original === undefined) {
      Reflect.deleteProperty(navigator, 'clipboard')
    } else {
      Object.defineProperty(navigator, 'clipboard', original)
    }
  }
}

function CopyButtons(): React.JSX.Element {
  return (
    <div className="section flex flex-col gap-4 px-4">
      <div className="flex items-center gap-4">
        <ClipboardCopyButton text="[캐릭터1, 캐릭터2], []" />
      </div>
      <div className="flex items-center gap-4">
        <ClipboardCopyButton text="ABCD-1234" label="코드 복사" />
      </div>
    </div>
  )
}

function clickAll(canvasElement: HTMLElement): void {
  for (const button of canvasElement.querySelectorAll('button')) {
    button.click()
  }
}

export const 복사: Story = {
  render: () => <CopyButtons />
}

export const 복사함: Story = {
  render: () => <CopyButtons />,
  beforeEach: () => stubClipboard(async () => {}),
  play: ({ canvasElement }) => clickAll(canvasElement)
}

export const 복사실패: Story = {
  render: () => <CopyButtons />,
  beforeEach: () => stubClipboard(async () => Promise.reject(new Error('복사 거부'))),
  play: ({ canvasElement }) => clickAll(canvasElement)
}
