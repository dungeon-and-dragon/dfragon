import { Button, shapes, Tooltip } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
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
import { styles as tableStyles } from '../equipment/item-table.style'
import { styles } from './SkillSide.style'
import { styles as markStyles } from './SkillTab.style'
import { ENHANCEMENT_LABELS, EVOLUTION_NUMERALS } from './upgrade-labels'

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
      <h2 {...stylex.props(tableStyles.heading)}>스킬 체인</h2>
      <ol {...stylex.props(styles.chain)}>
        {chain.skills.map(({ name, icon }, index) => (
          <li key={`${name}-${index}`} {...stylex.props(styles.chainLink)}>
            <span {...stylex.props(styles.chainSkill)}>
              {icon !== null ? (
                <span {...stylex.props(styles.skillIcon)}>
                  <SkillSprite icon={icon} />
                </span>
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
  tooltip?: React.ReactNode
}): React.JSX.Element {
  const content = (
    <>
      <img
        src={mark}
        alt=""
        draggable={false}
        {...stylex.props(styles.branchMark, !picked && styles.branchMarkDim)}
      />
      {label}
    </>
  )
  const branchStyle = stylex.props(styles.branch, picked && styles.branchPicked)
  if (tooltip === undefined) {
    return (
      <span aria-current={picked || undefined} {...branchStyle}>
        {content}
      </span>
    )
  }

  return (
    // 설명 창이 아래 갈래를 덮으므로, 마우스가 설명 창으로 옮겨 가면 닫아 다른 갈래를 볼 수 있게 한다.
    <Tooltip.Root disableHoverablePopup>
      <Tooltip.Trigger delay={0} closeDelay={0} aria-current={picked || undefined} {...branchStyle}>
        {content}
      </Tooltip.Trigger>
      <Tooltip.Popup side="bottom" align="end">
        <span {...stylex.props(styles.tooltip)}>{tooltip}</span>
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
      trigger={
        <span {...stylex.props(styles.skillIcon, row.picked !== null && styles.skillIconPicked)} />
      }
    >
      <SkillSprite icon={row.icon} />
      {evolutionMark !== null && (
        <img
          src={evolutionMark}
          alt=""
          draggable={false}
          {...stylex.props(markStyles.evolutionMark)}
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
      trigger={<span {...stylex.props(styles.rowTitle)} />}
    >
      {row.name}
      {row.requiredLevel !== null && (
        <span {...stylex.props(styles.rowLevel)}>{`${row.requiredLevel}레벨`}</span>
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
      <h2 {...stylex.props(tableStyles.heading)}>스킬 개화</h2>
      <ul {...stylex.props(styles.rows)}>
        {rows.map((row) => (
          <li key={row.skillId} {...stylex.props(styles.row)}>
            <UpgradeSkillIcon
              row={row}
              evolutionMark={
                row.picked !== null ? skillMarkOf(marks, 'evolution', row.picked) : null
              }
              source={source}
            />
            <div {...stylex.props(styles.rowBody)}>
              <RowTitle row={row} source={source} />
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
                        <GameText lines={branch.basicExplain} style={styles.tooltipSummary} />
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
    return <h2 {...stylex.props(tableStyles.heading)}>스킬 강화 없음</h2>
  }

  return (
    <section aria-label="스킬 강화">
      <h2 {...stylex.props(tableStyles.heading)}>스킬 강화</h2>
      <ul {...stylex.props(styles.rows)}>
        {rows.map((row) => (
          <li key={row.skillId} {...stylex.props(styles.row)}>
            <UpgradeSkillIcon row={row} evolutionMark={null} source={source} />
            <div {...stylex.props(styles.rowBody)}>
              <RowTitle row={row} source={source} />
              <div {...stylex.props(styles.branches)}>
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
