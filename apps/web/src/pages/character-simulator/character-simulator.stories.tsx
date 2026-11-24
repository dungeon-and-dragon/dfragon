import { equipmentVariantsOf } from '@dfragon/lib/equipment-variants'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { RequestHandler } from 'msw'
import { storyCharacterDetail } from '#pages/character/api/character.fixture'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { withPendingReleaseWeapon, withSwitchingEquipment } from './api/simulation.fixture'
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

// 조작 패널(aside)도 고른 줄의 이름을 가지므로 패널을 뺀 컨트롤에서 찾는다. 열린 목록은 Portal로 문서 끝에 그려지므로 canvas가 아니라 문서에서 항목을 찾는다.
async function pick(canvas: HTMLElement, label: string, option: string): Promise<void> {
  const trigger = await waitForElement(
    () => canvas.querySelector<HTMLElement>(`:not(aside)[aria-label="${label}"]`) ?? undefined
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

// 장비, 조율, 마법부여, 세트, 아바타는 펼쳐 둔 버튼 묶음이라 묶음 안에서 버튼을 누른다.
async function toggle(canvas: HTMLElement, label: string, name: string): Promise<void> {
  const button = await waitForElement(() =>
    [...canvas.querySelectorAll<HTMLElement>(`:not(aside)[aria-label="${label}"] button`)].find(
      (candidate) => candidate.textContent?.startsWith(name)
    )
  )
  button.click()
  await pause(STEP_SETTLE_MS)
}

async function press(canvas: HTMLElement, label: string, times = 1): Promise<void> {
  const control = await waitForElement(
    () => canvas.querySelector<HTMLElement>(`:not(aside)[aria-label="${label}"]`) ?? undefined
  )

  // 누를 때마다 화면이 새 값을 그린 뒤 다음을 눌러야 한 칸씩 쌓인다.
  for (let count = 0; count < times; count++) {
    control.click()
    await pause(STEP_SETTLE_MS)
  }
}

async function choose(canvas: HTMLElement, slotName: string): Promise<void> {
  const row = await waitForElement(() =>
    [...canvas.querySelectorAll<HTMLElement>('tbody tr')].find(
      (candidate) => candidate.querySelector('td')?.textContent === slotName
    )
  )
  row.querySelector<HTMLElement>('button')?.click()
  await pause(STEP_SETTLE_MS)
}

// 서약 구획 줄의 첫 칸은 "세트", "서약", "결정 1"처럼 줄 이름이다.
async function chooseOath(canvas: HTMLElement, label: string): Promise<void> {
  const row = await waitForElement(() => {
    const section = [...canvas.querySelectorAll('section')].find(
      (candidate) => candidate.querySelector('h2')?.textContent === '서약'
    )

    return [...(section?.querySelectorAll<HTMLElement>('tbody tr') ?? [])].find(
      (candidate) => candidate.querySelector('td')?.textContent === label
    )
  })
  row.querySelector<HTMLElement>('button')?.click()
  await pause(STEP_SETTLE_MS)
}

async function chooseCrystal(canvas: HTMLElement, slotNo: number): Promise<void> {
  await chooseOath(canvas, `결정 ${slotNo + 1}`)
}

type Detail = ReturnType<typeof storyCharacterDetail>

function screenStory(role: Role, handlers: Handlers, edit = (detail: Detail) => detail): Story {
  const detail = edit(storyCharacterDetail(role))
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
  await choose(canvasElement, '상의')
  await press(canvasElement, '상의 증폭')
  await press(canvasElement, '상의 수치 올리기', 10)
  await choose(canvasElement, '목걸이')
  await toggle(canvasElement, '목걸이 마법부여', '최종 데미지 증가 +2%')
}

async function changeSlotItems({ canvasElement }: { canvasElement: HTMLElement }) {
  await choose(canvasElement, '칭호')
  await toggle(canvasElement, '칭호 교체', '진정한 각성을 이룬 자')
  await choose(canvasElement, '크리쳐')
  await toggle(canvasElement, '크리쳐 교체', 'SD 흰 구름 전령 에를리히')
  await choose(canvasElement, '오라')
  await toggle(canvasElement, '오라 교체', '열대야의 추억')
}

// 딜러 story 캐릭터가 낀 세트다.
const DEALER_SET = '4ee7bd5912cda6e2a24c1f36d5202b46'

function variantName(slotId: 'JACKET' | 'EARRING', kind: string): string {
  const variant = equipmentVariantsOf(DEALER_SET, slotId).find((found) => found.kind === kind)

  if (variant === undefined) {
    throw new Error(`${slotId} ${kind} 선택지가 없습니다.`)
  }

  return variant.item.itemName
}

async function changeVariant({ canvasElement }: { canvasElement: HTMLElement }) {
  await choose(canvasElement, '상의')
  await toggle(canvasElement, '상의 교체', variantName('JACKET', '잠식'))
}

async function changeTune({ canvasElement }: { canvasElement: HTMLElement }) {
  await choose(canvasElement, '보조장비')
  await toggle(canvasElement, '보조장비 조율', 'II')
  await choose(canvasElement, '상의')
  await toggle(canvasElement, '상의 조율', 'III')
}

async function chooseExalted({ canvasElement }: { canvasElement: HTMLElement }) {
  await choose(canvasElement, '귀걸이')
  await toggle(canvasElement, '귀걸이 교체', variantName('EARRING', '유일'))
  await press(canvasElement, '귀걸이 정밀도 내리기', 5)
}

async function changeOathTune({ canvasElement }: { canvasElement: HTMLElement }) {
  await chooseCrystal(canvasElement, 6)
  await toggle(canvasElement, '결정 7 조율', 'III')
  await chooseCrystal(canvasElement, 7)
  await toggle(canvasElement, '결정 8 조율', 'II')
}

async function changeEquipmentSet({ canvasElement }: { canvasElement: HTMLElement }) {
  await choose(canvasElement, '세트')
  await toggle(canvasElement, '장비 세트', '그림자에 숨은 죽음 세트')
}

async function changeOathSet({ canvasElement }: { canvasElement: HTMLElement }) {
  await chooseOath(canvasElement, '세트')
  await toggle(canvasElement, '서약 세트', '어둠에 잠긴 그림자 서약')
}

async function changeOathGrades({ canvasElement }: { canvasElement: HTMLElement }) {
  await chooseOath(canvasElement, '서약')
  await toggle(canvasElement, '서약 교체', '전장을 태우는 용투 서약')
  // 태초 결정은 3개까지라 결정 9를 내린 뒤 결정 8을 태초로 올린다.
  await chooseCrystal(canvasElement, 8)
  await toggle(canvasElement, '결정 9 교체', '용투 : 완전한 광휘 결정')
  await chooseCrystal(canvasElement, 7)
  await toggle(canvasElement, '결정 8 교체', '용투 : 태초의 광휘 결정')
}

async function changeMistOath({ canvasElement }: { canvasElement: HTMLElement }) {
  await chooseOath(canvasElement, '서약')
  await toggle(canvasElement, '서약 교체', '세계를 태우는 용투 서약')
}

async function changeOathUpgrade({ canvasElement }: { canvasElement: HTMLElement }) {
  await choose(canvasElement, '묵언의 진의')
  await press(canvasElement, '여섯 번째 진의')
}

async function changeSwitching({ canvasElement }: { canvasElement: HTMLElement }) {
  await choose(canvasElement, '스위칭')
  await pick(canvasElement, '스위칭 레벨', '20레벨')
  await press(canvasElement, '짙편린 부위 수 올리기', 3)
}

async function chooseBestAvatar({ canvasElement }: { canvasElement: HTMLElement }) {
  await choose(canvasElement, '아바타')
  await toggle(canvasElement, '아바타', '종결 아바타와 엠블렘')
}

async function changeWeaponTune({ canvasElement }: { canvasElement: HTMLElement }) {
  await choose(canvasElement, '무기')
  await toggle(canvasElement, '무기 조율', 'II')
}

async function chooseWeapon({ canvasElement }: { canvasElement: HTMLElement }) {
  await choose(canvasElement, '무기')
}

// 딜러 story 캐릭터가 9부위에 짙편린을 등록한 것으로 둔다.
function withNineSwitchingEquipment(detail: Detail): Detail {
  return withSwitchingEquipment(detail, 9)
}

// 딜러 story 캐릭터의 해방 무기를 해방 수치 81의 "억압 - " 아이템으로 바꾼다.
function withPendingRelease(detail: Detail): Detail {
  return withPendingReleaseWeapon(detail, 81)
}

export const 딜러: Story = screenStory('dealer', simulatorStoryHandlers.calculated)

export const 값바꿈: Story = {
  ...screenStory('dealer', simulatorStoryHandlers.calculated),
  play: changeDealerEquipment
}

export const 슬롯교체: Story = {
  ...screenStory('dealer', simulatorStoryHandlers.calculated),
  play: changeSlotItems
}

export const 등급교체: Story = {
  ...screenStory('dealer', simulatorStoryHandlers.calculated),
  play: changeVariant
}

export const 조율바꿈: Story = {
  ...screenStory('dealer', simulatorStoryHandlers.calculated),
  play: changeTune
}

export const 유일장비: Story = {
  ...screenStory('dealer', simulatorStoryHandlers.calculated),
  play: chooseExalted
}

export const 서약결정조율: Story = {
  ...screenStory('dealer', simulatorStoryHandlers.calculated),
  play: changeOathTune
}

export const 장비세트: Story = {
  ...screenStory('dealer', simulatorStoryHandlers.calculated),
  play: changeEquipmentSet
}

export const 서약세트: Story = {
  ...screenStory('dealer', simulatorStoryHandlers.calculated),
  play: changeOathSet
}

export const 서약등급: Story = {
  ...screenStory('dealer', simulatorStoryHandlers.calculated),
  play: changeOathGrades
}

// 버퍼 story 캐릭터는 영겁의 안개 서약을 낀다.
export const 안개서약교체: Story = {
  ...screenStory('buffer', simulatorStoryHandlers.calculated),
  play: changeMistOath
}

export const 진의: Story = {
  ...screenStory('dealer', simulatorStoryHandlers.calculated),
  play: changeOathUpgrade
}

export const 스위칭: Story = {
  ...screenStory('dealer', simulatorStoryHandlers.calculated, withNineSwitchingEquipment),
  play: changeSwitching
}

export const 종결아바타: Story = {
  ...screenStory('dealer', simulatorStoryHandlers.calculated),
  play: chooseBestAvatar
}

export const 무기조율: Story = {
  ...screenStory('buffer', simulatorStoryHandlers.calculated),
  play: changeWeaponTune
}

export const 무기교체: Story = {
  ...screenStory('dealer', simulatorStoryHandlers.calculated),
  play: chooseWeapon
}

export const 무기해방: Story = {
  ...screenStory('dealer', simulatorStoryHandlers.calculated, withPendingRelease),
  play: chooseWeapon
}

export const 휴대폰: Story = {
  ...screenStory('dealer', simulatorStoryHandlers.calculated),
  globals: { viewport: { value: 'phone', isRotated: false } }
}

export const 버퍼: Story = screenStory('buffer', simulatorStoryHandlers.calculated)

export const 건너뜀: Story = {
  ...screenStory('dealer', simulatorStoryHandlers.skipped),
  play: changeDealerEquipment
}

export const 엔진없음: Story = screenStory('dealer', simulatorStoryHandlers.noEngine)

export const 받는중: Story = screenStory('dealer', simulatorStoryHandlers.loading)
