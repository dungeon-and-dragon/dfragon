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

// 캐릭터 상세 서약 탭의 선택지 표기와 같다.
const UPGRADE_KIND_LABELS: Readonly<Record<OathUpgradeKind, string>> = {
  Damage: '최종 데미지',
  Cooltime: '쿨타임 감소',
  Oathpoint: '서약 포인트',
  Speed: '이동속도',
  SkillRange: '범위',
  DamageReduce: '방어력'
}

export type OathUpgradeOptionView = Readonly<{ option: string; label: string }>

export type OathUpgradeStepView = Readonly<{
  step: number
  name: string
  options: readonly OathUpgradeOptionView[]
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

function toStepView({ step, name, options }: ReturnType<typeof oathUpgradeSteps>[number]) {
  const stepName = name.replace(UPGRADE_STEP_PREFIX, '')
  const optionViews = options.map(({ option, kind }) => ({
    option,
    label: UPGRADE_KIND_LABELS[kind]
  }))

  return { step, name: stepName, options: optionViews }
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

  const title = titleOf(first.name)
  const stepViews = steps.map(toStepView)
  const worn = wornUpgradeOf(info)

  return { title, steps: stepViews, worn }
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

/**
 * 단계의 선택지를 고르거나(option) 그 단계를 내린다(null). 올리지 않은 단계는 바로 다음 단계만 올릴 수 있고, 단계를 내리면
 * 그 뒤 단계도 함께 내린다. 착용한 진의와 같아지면 바꾸지 않은 것으로 둔다.
 */
export function changeUpgradeStep(
  upgrade: SimulatorOathUpgrade,
  changes: OathUpgradeChanges,
  step: number,
  option: string | null
): OathUpgradeChanges {
  const current = upgradeOf(upgrade, changes)

  if (step < 1 || step > current.length + 1) {
    return changes
  }

  if (option !== null && findOathUpgradeOption(step, option) === null) {
    return changes
  }

  const kept = current.slice(0, step - 1)
  const rest = current.slice(step)
  const next = option !== null ? [...kept, { step, option }, ...rest] : kept

  if (isSameUpgrade(next, upgrade.worn)) {
    return null
  }

  return next
}

/** 진의 줄에 보일 지금 단계의 이름이다. 올린 단계가 없으면 null이다. */
export function upgradeStepNameOf(
  upgrade: SimulatorOathUpgrade,
  changes: OathUpgradeChanges
): string | null {
  const last = upgradeOf(upgrade, changes).at(-1)
  const step = upgrade.steps.find((candidate) => candidate.step === last?.step)

  if (step === undefined) {
    return null
  }

  return step.name
}
