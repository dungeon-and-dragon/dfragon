import {
  findOathUpgradeOption,
  type OathUpgradeKind,
  type OathUpgradeSelection,
  oathUpgradeSteps
} from '@dfragon/lib/equipment-variants'
import type { CharacterDetailView } from '#entities/character'

type OathInfo = NonNullable<NonNullable<CharacterDetailView['oath']>['info']>

// 단계 이름은 "<묵언의 진의> - 첫 번째 진의" 모양이라, 캐릭터 상세 서약 탭처럼 꺾쇠 안 글자를 제목으로, 그 뒤를 단계 이름으로 쓴다.
const UPGRADE_TITLE_PATTERN = /<([^>]+)>/
const UPGRADE_STEP_PREFIX = /^<[^>]+>\s*-\s*/

// 엔진은 서약 포인트가 아닌 선택지를 모두 같은 값으로 계산해, 새로 올리는 단계는 1~4단계는 최종 데미지, 5~9단계는 이동속도로 둔다.
const DEFAULT_KINDS: ReadonlySet<OathUpgradeKind> = new Set(['Damage', 'Speed'])

export type OathUpgradeStepView = Readonly<{
  step: number
  name: string
  defaultOption: string
}>

/** worn은 착용한 진의를 1단계부터 차례로 둔 것이다. */
export type SimulatorOathUpgrade = Readonly<{
  title: string
  steps: readonly OathUpgradeStepView[]
  worn: readonly OathUpgradeSelection[]
}>

/** null이면 착용한 진의 그대로다. */
export type OathUpgradeChanges = readonly OathUpgradeSelection[] | null

function titleOf(stepName: string): string {
  const title = stepName.match(UPGRADE_TITLE_PATTERN)?.[1]

  if (title === undefined) {
    return stepName
  }

  return title
}

function toStepView({
  step,
  name,
  options
}: ReturnType<typeof oathUpgradeSteps>[number]): OathUpgradeStepView | null {
  const defaultOption = options.find(({ kind }) => DEFAULT_KINDS.has(kind))?.option

  if (defaultOption === undefined) {
    return null
  }

  const stepName = name.replace(UPGRADE_STEP_PREFIX, '')

  return { step, name: stepName, defaultOption }
}

// 응답의 단계를 lib 단계 이름으로 맞추고, 1단계부터 끊기지 않고 이어진 단계까지만 착용한 진의로 읽는다.
function wornUpgradeOf(info: OathInfo): OathUpgradeSelection[] {
  const steps = oathUpgradeSteps()
  const worn = (info.oathUpgrade?.options ?? []).flatMap(({ stepName, optionName }) => {
    const step = steps.find(({ name }) => name === stepName)?.step

    if (
      step === undefined ||
      optionName === null ||
      findOathUpgradeOption(step, optionName) === null
    ) {
      return []
    }

    return [{ step, option: optionName }]
  })
  const sorted = worn.toSorted((a, b) => a.step - b.step)
  const broken = sorted.findIndex(({ step }, index) => step !== index + 1)

  if (broken === -1) {
    return sorted
  }

  return sorted.slice(0, broken)
}

/** 서약 본체가 없으면 진의 줄을 두지 않는다. */
export function toSimulatorOathUpgrade(
  detail: Pick<CharacterDetailView, 'oath'>
): SimulatorOathUpgrade | null {
  const info = detail.oath?.info

  if (info?.itemId == null) {
    return null
  }

  const steps = oathUpgradeSteps()
  const [first] = steps

  if (first === undefined) {
    return null
  }

  const stepViews = steps.map(toStepView)

  if (stepViews.includes(null)) {
    return null
  }

  const title = titleOf(first.name)
  const worn = wornUpgradeOf(info)
  const presentStepViews = stepViews.filter((view) => view !== null)

  return { title, steps: presentStepViews, worn }
}

export function upgradeOf(
  upgrade: SimulatorOathUpgrade,
  changes: OathUpgradeChanges
): readonly OathUpgradeSelection[] {
  if (changes === null) {
    return upgrade.worn
  }

  return changes
}

function isSameUpgrade(
  a: readonly OathUpgradeSelection[],
  b: readonly OathUpgradeSelection[]
): boolean {
  return (
    a.length === b.length &&
    a.every(({ step, option }, index) => b[index]?.step === step && b[index]?.option === option)
  )
}

function settledUpgrade(
  upgrade: SimulatorOathUpgrade,
  next: readonly OathUpgradeSelection[]
): OathUpgradeChanges {
  if (isSameUpgrade(next, upgrade.worn)) {
    return null
  }

  return next
}

/**
 * 단계를 해금하면 그 앞 단계도 모두 해금하고, 새로 해금한 단계만 기본 선택지로 채운다. 해금을 풀면 그 뒤 단계도 함께 내린다.
 */
export function changeUpgradeUnlock(
  upgrade: SimulatorOathUpgrade,
  changes: OathUpgradeChanges,
  step: number,
  unlocked: boolean
): OathUpgradeChanges {
  const current = upgradeOf(upgrade, changes)

  if (!unlocked) {
    return settledUpgrade(upgrade, current.slice(0, step - 1))
  }

  const added = upgrade.steps
    .filter((view) => view.step > current.length && view.step <= step)
    .map((view) => ({ step: view.step, option: view.defaultOption }))

  return settledUpgrade(upgrade, [...current, ...added])
}
