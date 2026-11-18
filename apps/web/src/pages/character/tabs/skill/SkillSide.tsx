import { Button, Tooltip } from '@dfragon/ui'
import {
  type EnhancementRow,
  type EvolutionRow,
  type SkillChain,
  type SkillMarks,
  type SkillUpgradeBoard,
  skillMarkOf
} from '#core/catalog/skill-window'
import { CheckIcon } from '../../../../components/CheckIcon'
import { CopyIcon } from '../../../../components/CopyIcon'
import { useClipboardCopy } from '../../../../hooks/useClipboardCopy'
import { GameText } from '../GameText'
import { type SkillAdoptionSource, SkillAdoptionHover } from './SkillAdoptionTooltip'
import { SkillSprite } from './SkillSprite'
import { itemTableClasses } from '../equipment/item-classes'
import { EVOLUTION_MARK, PIXELATED } from './skill-classes'
import { ENHANCEMENT_LABELS, EVOLUTION_NUMERALS } from './upgrade-labels'

const { heading: HEADING } = itemTableClasses
const SKILL_ICON = 'relative size-7 shrink-0 select-none'
const PICKED_RING = 'shadow-[0_0_0_2px_var(--color-signal)]'
const BRANCH =
  'm-0 box-border inline-flex h-7 cursor-default items-center gap-2 rounded-control border px-2 [font-family:inherit] text-xs'
const BRANCH_IDLE = 'border-dashed border-line-strong bg-surface text-fg-subtle hover:bg-control'
const BRANCH_PICKED =
  'border-solid border-signal bg-inset font-semibold text-fg shadow-[0_0_0_1px_var(--color-signal)]'
const ROWS = 'm-0 list-none p-0'
const ROW = 'box-border flex min-h-14 items-center gap-3 border-b border-line px-4 py-2'
const ROW_BODY = 'flex min-w-0 grow flex-col gap-2'
const BRANCHES = 'flex flex-wrap gap-2'

export function SkillTreeCode({ hash }: { hash: string }): React.JSX.Element {
  const clipboard = useClipboardCopy(hash)
  const Icon = clipboard.status === 'copied' ? CheckIcon : CopyIcon

  return (
    <section aria-label="스킬 트리 코드">
      <h2 className={HEADING}>스킬 트리 코드</h2>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <code
          title={hash}
          className="box-border h-7 min-w-0 grow truncate rounded-control border border-line bg-surface px-2 font-mono text-xs/6.5 text-fg-muted"
        >
          {hash}
        </code>
        <Button size="sm" onClick={clipboard.copy}>
          <span className="inline-flex items-center gap-2">
            <Icon width={14} height={14} />
            코드 복사
          </span>
        </Button>
        <span role="status" className="sr-only">
          {clipboard.status === 'copied' && '스킬 트리 코드를 복사했습니다.'}
          {clipboard.status === 'failed' && '클립보드에 복사하지 못했습니다.'}
        </span>
      </div>
    </section>
  )
}

function ChevronRight(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className="mt-2 shrink-0 text-fg-subtle"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

export function SkillChainSection({ chain }: { chain: SkillChain | null }): React.JSX.Element {
  if (chain === null) {
    return <h2 className={HEADING}>스킬 체인 없음</h2>
  }

  return (
    <section aria-label="스킬 체인">
      <h2 className={HEADING}>스킬 체인</h2>
      <ol className="m-0 flex list-none flex-wrap items-start gap-y-2 border-b border-line px-4 py-4">
        {chain.skills.map(({ name, icon }, index) => (
          <li key={`${name}-${index}`} className="flex items-start gap-1">
            <span className="flex w-16 flex-col items-center gap-2 text-center text-2xs text-fg-muted">
              {icon !== null ? (
                <span className={SKILL_ICON}>
                  <SkillSprite icon={icon} />
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className={`${SKILL_ICON} box-border rounded-control border border-line-strong bg-inset`}
                />
              )}
              {name}
            </span>
            {index < chain.skills.length - 1 && <ChevronRight />}
          </li>
        ))}
      </ol>
    </section>
  )
}

function Branch({
  picked,
  mark,
  label,
  tooltip
}: {
  picked: boolean
  mark: string
  label: string
  tooltip?: React.ReactNode
}): React.JSX.Element {
  const content = (
    <>
      <img
        src={mark}
        alt=""
        draggable={false}
        className={`size-[17px] ${PIXELATED} ${picked ? '' : 'opacity-45'}`}
      />
      {label}
    </>
  )
  const branchClassName = `${BRANCH} ${picked ? BRANCH_PICKED : BRANCH_IDLE}`
  if (tooltip === undefined) {
    return (
      <span aria-current={picked || undefined} className={branchClassName}>
        {content}
      </span>
    )
  }

  return (
    // 설명 창이 아래 갈래를 덮으므로, 마우스가 설명 창으로 옮겨 가면 닫아 다른 갈래를 볼 수 있게 한다.
    <Tooltip.Root disableHoverablePopup>
      <Tooltip.Trigger
        delay={0}
        closeDelay={0}
        aria-current={picked || undefined}
        className={branchClassName}
      >
        {content}
      </Tooltip.Trigger>
      <Tooltip.Popup side="bottom" align="end">
        <span className="flex w-85 flex-col gap-2 py-1 text-xs/4.5 break-keep whitespace-normal">
          {tooltip}
        </span>
      </Tooltip.Popup>
    </Tooltip.Root>
  )
}

// 표가 화면 오른쪽 끝 열이라 Tooltip을 왼쪽에 띄워 잘리지 않게 한다.
const ADOPTION_SIDE = 'left'

function UpgradeSkillIcon({
  row,
  evolutionMark,
  source
}: {
  row: EvolutionRow | EnhancementRow
  evolutionMark: string | null
  source: SkillAdoptionSource
}): React.JSX.Element {
  return (
    <SkillAdoptionHover
      skill={row}
      source={source}
      side={ADOPTION_SIDE}
      trigger={<span className={`${SKILL_ICON} ${row.picked !== null ? PICKED_RING : ''}`} />}
    >
      <SkillSprite icon={row.icon} />
      {evolutionMark !== null && (
        <img
          src={evolutionMark}
          alt=""
          draggable={false}
          className={`${EVOLUTION_MARK} ${PIXELATED}`}
        />
      )}
    </SkillAdoptionHover>
  )
}

function RowTitle({
  row,
  source
}: {
  row: EvolutionRow | EnhancementRow
  source: SkillAdoptionSource
}): React.JSX.Element {
  return (
    <SkillAdoptionHover
      skill={row}
      source={source}
      side={ADOPTION_SIDE}
      trigger={<span className="flex items-baseline gap-2 self-start font-medium" />}
    >
      {row.name}
      {row.requiredLevel !== null && (
        <span className="text-2xs text-fg-subtle select-none">{`${row.requiredLevel}레벨`}</span>
      )}
    </SkillAdoptionHover>
  )
}

function EvolutionSection({
  rows,
  marks,
  source
}: {
  rows: readonly EvolutionRow[]
  marks: SkillMarks
  source: SkillAdoptionSource
}): React.JSX.Element {
  return (
    <section aria-label="스킬 개화">
      <h2 className={HEADING}>스킬 개화</h2>
      <ul className={ROWS}>
        {rows.map((row) => (
          <li key={row.skillId} className={ROW}>
            <UpgradeSkillIcon
              row={row}
              evolutionMark={
                row.picked !== null ? skillMarkOf(marks, 'evolution', row.picked) : null
              }
              source={source}
            />
            <div className={ROW_BODY}>
              <RowTitle row={row} source={source} />
              <div className={BRANCHES}>
                {row.branches.map((branch) => (
                  <Branch
                    key={branch.type}
                    picked={row.picked === branch.type}
                    mark={skillMarkOf(marks, 'evolution', branch.type)}
                    label={branch.name}
                    tooltip={
                      <>
                        <b className="font-semibold">
                          {`${EVOLUTION_NUMERALS[branch.type]} ${branch.name}`}
                        </b>
                        <GameText lines={branch.basicExplain} className="text-fg-muted" />
                        <GameText lines={branch.explain} />
                      </>
                    }
                  />
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function EnhancementSection({
  rows,
  marks,
  source
}: {
  rows: readonly EnhancementRow[]
  marks: SkillMarks
  source: SkillAdoptionSource
}): React.JSX.Element {
  if (rows.length === 0) {
    return <h2 className={HEADING}>스킬 강화 없음</h2>
  }

  return (
    <section aria-label="스킬 강화">
      <h2 className={HEADING}>스킬 강화</h2>
      <ul className={ROWS}>
        {rows.map((row) => (
          <li key={row.skillId} className={ROW}>
            <UpgradeSkillIcon row={row} evolutionMark={null} source={source} />
            <div className={ROW_BODY}>
              <RowTitle row={row} source={source} />
              <div className={BRANCHES}>
                {row.branches.map((branch) => (
                  <Branch
                    key={branch.type}
                    picked={row.picked === branch.type}
                    mark={skillMarkOf(marks, 'enhancement', branch.type)}
                    label={ENHANCEMENT_LABELS[branch.type]}
                  />
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function SkillUpgradeSections({
  board,
  source
}: {
  board: SkillUpgradeBoard
  source: SkillAdoptionSource
}): React.JSX.Element {
  return (
    <>
      <EvolutionSection rows={board.evolutions} marks={board.marks} source={source} />
      <EnhancementSection rows={board.enhancements} marks={board.marks} source={source} />
    </>
  )
}
