import { Button, shapes, Tooltip } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import {
  type EnhancementRow,
  type EvolutionRow,
  type SkillChain,
  type SkillMarks,
  type SkillUpgradeBoard,
  skillMarkOf,
  type UpgradeType
} from '@dfragon/client-core/shared/search/skill-window'
import { CheckIcon } from '../../../../components/CheckIcon'
import { CopyIcon } from '../../../../components/CopyIcon'
import { useClipboardCopy } from '../../../../hooks/useClipboardCopy'
import { GameText } from '../GameText'
import { SkillSprite } from './SkillSprite'
import { styles as tableStyles } from '../equipment/item-table.style'
import { styles } from './SkillSide.style'
import { styles as markStyles } from './SkillTab.style'

const EVOLUTION_NUMERALS: Readonly<Record<UpgradeType, string>> = { 1: 'Ⅰ', 2: 'Ⅱ' }
const ENHANCEMENT_LABELS: Readonly<Record<UpgradeType, string>> = {
  1: '데미지',
  2: '쿨타임 감소'
}

export function SkillTreeCode({ hash }: { hash: string }): React.JSX.Element {
  const clipboard = useClipboardCopy(hash)
  const Icon = clipboard.status === 'copied' ? CheckIcon : CopyIcon

  return (
    <section aria-label="스킬 트리 코드">
      <h2 {...stylex.props(tableStyles.heading)}>스킬 트리 코드</h2>
      <div {...stylex.props(styles.codeRow)}>
        <code title={hash} {...stylex.props(styles.code)}>
          {hash}
        </code>
        <Button size="sm" onClick={clipboard.copy}>
          <span {...stylex.props(styles.copyLabel)}>
            <Icon width={14} height={14} />
            코드 복사
          </span>
        </Button>
        <span role="status" {...stylex.props(shapes.srOnly)}>
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
      {...stylex.props(styles.chainArrow)}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

export function SkillChainSection({ chain }: { chain: SkillChain | null }): React.JSX.Element {
  if (chain === null) {
    return <h2 {...stylex.props(tableStyles.heading)}>스킬 체인 없음</h2>
  }

  return (
    <section aria-label="스킬 체인">
      <h2 {...stylex.props(tableStyles.heading)}>
        스킬 체인 <span {...stylex.props(tableStyles.count)}>{chain.skills.length}</span>
        <span {...stylex.props(styles.spacer)} />
        {chain.resetTime !== null && `초기화 시간 ${chain.resetTime}`}
      </h2>
      <ol {...stylex.props(styles.chain)}>
        {chain.skills.map(({ name, icon }, index) => (
          <li key={`${name}-${index}`} {...stylex.props(styles.chainLink)}>
            <span {...stylex.props(styles.chainSkill)}>
              {icon !== null ? (
                <SkillSprite icon={icon} />
              ) : (
                <span aria-hidden="true" {...stylex.props(styles.skillIcon, styles.emptyIcon)} />
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
  tooltip: React.ReactNode
}): React.JSX.Element {
  const content = (
    <>
      <img
        src={mark}
        alt=""
        {...stylex.props(styles.branchMark, !picked && styles.branchMarkDim)}
      />
      {label}
    </>
  )
  const branchStyle = stylex.props(styles.branch, picked && styles.branchPicked)
  if (tooltip === null) {
    return (
      <span aria-current={picked || undefined} {...branchStyle}>
        {content}
      </span>
    )
  }

  return (
    <Tooltip.Root>
      <Tooltip.Trigger delay={0} closeDelay={0} aria-current={picked || undefined} {...branchStyle}>
        {content}
      </Tooltip.Trigger>
      <Tooltip.Popup side="bottom" align="end">
        <span {...stylex.props(styles.tooltip)}>{tooltip}</span>
      </Tooltip.Popup>
    </Tooltip.Root>
  )
}

function UpgradeSkillIcon({
  row,
  evolutionMark
}: {
  row: EvolutionRow | EnhancementRow
  evolutionMark: string | null
}): React.JSX.Element {
  return (
    <span {...stylex.props(styles.skillIcon, row.picked !== null && styles.skillIconPicked)}>
      <SkillSprite icon={row.icon} />
      {evolutionMark !== null && (
        <img src={evolutionMark} alt="" {...stylex.props(markStyles.evolutionMark)} />
      )}
    </span>
  )
}

function RowTitle({ row }: { row: EvolutionRow | EnhancementRow }): React.JSX.Element {
  return (
    <span {...stylex.props(styles.rowTitle)}>
      {row.name}
      {row.requiredLevel !== null && (
        <span {...stylex.props(styles.rowLevel)}>{`${row.requiredLevel}레벨`}</span>
      )}
    </span>
  )
}

function pickedCount(rows: readonly (EvolutionRow | EnhancementRow)[]): number {
  return rows.filter(({ picked }) => picked !== null).length
}

function EvolutionSection({
  rows,
  marks
}: {
  rows: readonly EvolutionRow[]
  marks: SkillMarks
}): React.JSX.Element {
  return (
    <section aria-label="스킬 개화">
      <h2 {...stylex.props(tableStyles.heading)}>
        스킬 개화{' '}
        <span {...stylex.props(tableStyles.count)}>{`${pickedCount(rows)} / ${rows.length}`}</span>
      </h2>
      <ul {...stylex.props(styles.rows)}>
        {rows.map((row) => (
          <li key={row.skillId} {...stylex.props(styles.row)}>
            <UpgradeSkillIcon
              row={row}
              evolutionMark={
                row.picked !== null ? skillMarkOf(marks, 'evolution', row.picked) : null
              }
            />
            <div {...stylex.props(styles.rowBody)}>
              <RowTitle row={row} />
              <div {...stylex.props(styles.branches)}>
                {row.branches.map((branch) => (
                  <Branch
                    key={branch.type}
                    picked={row.picked === branch.type}
                    mark={skillMarkOf(marks, 'evolution', branch.type)}
                    label={branch.name}
                    tooltip={
                      <>
                        <b {...stylex.props(styles.tooltipTitle)}>
                          {`${EVOLUTION_NUMERALS[branch.type]} ${branch.name}`}
                        </b>
                        <GameText text={branch.basicExplain} style={styles.tooltipSummary} />
                        <GameText text={branch.explain} />
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
  marks
}: {
  rows: readonly EnhancementRow[]
  marks: SkillMarks
}): React.JSX.Element {
  return (
    <section aria-label="스킬 강화">
      <h2 {...stylex.props(tableStyles.heading)}>
        스킬 강화{' '}
        <span {...stylex.props(tableStyles.count)}>{`${pickedCount(rows)} / ${rows.length}`}</span>
      </h2>
      <ul {...stylex.props(styles.rows)}>
        {rows.map((row) => (
          <li key={row.skillId} {...stylex.props(styles.row)}>
            <UpgradeSkillIcon row={row} evolutionMark={null} />
            <div {...stylex.props(styles.rowBody)}>
              <RowTitle row={row} />
              <div {...stylex.props(styles.branches)}>
                {row.branches.map((branch) => (
                  <Branch
                    key={branch.type}
                    picked={row.picked === branch.type}
                    mark={skillMarkOf(marks, 'enhancement', branch.type)}
                    label={ENHANCEMENT_LABELS[branch.type]}
                    tooltip={
                      branch.explain !== '' ? (
                        <>
                          <b {...stylex.props(styles.tooltipTitle)}>
                            {`${row.name} ${ENHANCEMENT_LABELS[branch.type]}`}
                          </b>
                          <GameText text={branch.explain} />
                        </>
                      ) : null
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

export function SkillUpgradeSections({ board }: { board: SkillUpgradeBoard }): React.JSX.Element {
  return (
    <>
      <EvolutionSection rows={board.evolutions} marks={board.marks} />
      <EnhancementSection rows={board.enhancements} marks={board.marks} />
    </>
  )
}
