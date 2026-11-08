import * as stylex from '@stylexjs/stylex'
import { MISSING_VALUE } from '@dfragon/client-core/constants/cards'
import { formatCount, formatPoint, type StatLine } from '@dfragon/client-core/lib/character-item'
import { type OathView, toOathView } from '@dfragon/client-core/lib/character-oath'
import {
  type OathCatalog,
  type OathOptionCard,
  type OathSetBoard,
  oathItemIconOf,
  oathSetBoardOf
} from '@dfragon/client-core/shared/search/oath-catalog'
import { CheckIcon } from '../../../components/CheckIcon'
import { useOathCatalog } from '../../../hooks/useOathCatalog'
import type { CharacterTabProps } from './character-tab-props'
import { GameText } from './GameText'
import { styles as tableStyles } from './equipment/item-table.style'
import { ItemIcon, ItemName, RarityBadge, TuneNumeral } from './equipment/item-parts'
import { raritySolid, styles as partStyles } from './equipment/item-parts.style'
import { styles } from './oath/OathTab.style'

export function OathTab({ detail }: CharacterTabProps): React.JSX.Element | null {
  const catalog = useOathCatalog()
  if (detail.oath === null) {
    return null
  }

  const view = toOathView(detail.oath)
  const setInfo = detail.oath.setInfo
  const loaded = catalog.status === 'success' ? catalog.value : null
  const board = loaded !== null && setInfo !== null ? oathSetBoardOf(loaded, setInfo) : null

  return (
    <div {...stylex.props(tableStyles.root)}>
      {board !== null ? (
        <>
          <OathSetCard view={view} board={board} />
          <OathOptionCards options={board.options} />
        </>
      ) : (
        <OathStrip
          view={view}
          icon={loaded !== null && view.info !== null ? oathItemIconOf(loaded, view.info) : null}
        />
      )}
      <div {...stylex.props(styles.body)}>
        <div {...stylex.props(styles.main)}>
          {loaded !== null && board !== null && <OathBody view={view} catalog={loaded} />}
          <OathCrystals view={view} />
        </div>
        <OathEffects view={view} />
      </div>
    </div>
  )
}

function OathSetCard({
  view: { set },
  board
}: {
  view: OathView
  board: OathSetBoard
}): React.JSX.Element | null {
  if (set === null) {
    return null
  }

  return (
    <div {...stylex.props(styles.setCard)}>
      <span {...stylex.props(styles.setIconWell, raritySolid[set.rarity ?? 'unknown'])}>
        {board.icon !== null && <img src={board.icon} alt="" {...stylex.props(styles.setIcon)} />}
      </span>
      <span {...stylex.props(styles.setTitle)}>
        <ItemName name={set.name} rarity={set.rarity} />
        {set.rarityName !== null && <RarityBadge rarity={set.rarity}>{set.rarityName}</RarityBadge>}
        {set.point !== null && (
          <span {...stylex.props(partStyles.stripMuted)}>{formatPoint(set.point)}</span>
        )}
      </span>
    </div>
  )
}

function OathOptionCards({ options }: { options: readonly OathOptionCard[] }): React.JSX.Element {
  return (
    <div {...stylex.props(styles.options)}>
      {options.map((option) => (
        <article
          key={option.name}
          aria-label={option.name}
          aria-current={option.picked || undefined}
          {...stylex.props(styles.option, option.picked && styles.optionPicked)}
        >
          <div {...stylex.props(styles.optionIconColumn)}>
            <img
              src={option.icon}
              alt=""
              {...stylex.props(styles.optionIcon, !option.picked && styles.optionIconDim)}
            />
            {option.picked && (
              <span {...stylex.props(styles.pickedBadge)}>
                <CheckIcon width={12} height={12} strokeWidth={3} />
                선택
              </span>
            )}
          </div>
          {option.effect !== null && <GameText lines={option.effect} style={styles.optionEffect} />}
        </article>
      ))}
    </div>
  )
}

function OathBody({
  view: { info },
  catalog
}: {
  view: OathView
  catalog: OathCatalog
}): React.JSX.Element | null {
  if (info === null) {
    return null
  }

  return (
    <section aria-label="서약 본체">
      <h2 {...stylex.props(tableStyles.heading)}>서약 본체</h2>
      <div {...stylex.props(styles.bodyRow)}>
        <div {...stylex.props(partStyles.item)}>
          <ItemIcon itemId={info.itemId} src={oathItemIconOf(catalog, info)} rarity={info.rarity} />
          <ItemName name={info.itemName} rarity={info.rarity} />
        </div>
        <span {...stylex.props(partStyles.spacer)} />
        {info.setPoint !== null && (
          <span {...stylex.props(partStyles.stripMuted)}>{formatPoint(info.setPoint)}</span>
        )}
      </div>
    </section>
  )
}

function OathStrip({
  view: { info, set },
  icon
}: {
  view: OathView
  icon: string | null
}): React.JSX.Element | null {
  if (info === null && set === null) {
    return null
  }

  return (
    <div {...stylex.props(partStyles.strip)}>
      {info !== null && (
        <span {...stylex.props(partStyles.itemText)}>
          <span {...stylex.props(partStyles.stripLabel)}>서약</span>
          {icon !== null && <ItemIcon itemId={info.itemId} src={icon} rarity={info.rarity} />}
          <ItemName name={info.itemName} rarity={info.rarity} />
          {info.setPoint !== null && (
            <span {...stylex.props(partStyles.stripMuted)}>{formatPoint(info.setPoint)}</span>
          )}
        </span>
      )}
      <span {...stylex.props(partStyles.spacer)} />
      {set !== null && (
        <span {...stylex.props(partStyles.itemText)}>
          <span {...stylex.props(partStyles.stripLabel)}>서약 세트</span>
          <ItemName name={set.name} rarity={set.rarity} />
          {set.optionName !== null && (
            <span {...stylex.props(partStyles.stripMuted)}>{set.optionName}</span>
          )}
          {set.rarityName !== null && (
            <RarityBadge rarity={set.rarity}>{set.rarityName}</RarityBadge>
          )}
          {set.point !== null && (
            <span {...stylex.props(partStyles.stripMuted)}>{formatPoint(set.point)}</span>
          )}
        </span>
      )}
    </div>
  )
}

function OathCrystals({ view: { crystals } }: { view: OathView }): React.JSX.Element | null {
  if (crystals.length === 0) {
    return null
  }

  return (
    <section aria-label="서약 결정">
      <h2 {...stylex.props(tableStyles.heading)}>
        서약 결정 <span {...stylex.props(tableStyles.count)}>{formatCount(crystals.length)}</span>
      </h2>
      <table {...stylex.props(tableStyles.table)}>
        <thead>
          <tr>
            <th
              scope="col"
              {...stylex.props(tableStyles.head, tableStyles.first, styles.slotColumn)}
            >
              칸
            </th>
            <th scope="col" {...stylex.props(tableStyles.head)}>
              결정
            </th>
            <th
              scope="col"
              {...stylex.props(
                tableStyles.head,
                tableStyles.end,
                tableStyles.last,
                styles.pointColumn
              )}
            >
              세트 포인트
            </th>
          </tr>
        </thead>
        <tbody>
          {crystals.map((crystal, index) => (
            <tr key={`${crystal.slot}-${index}`} {...stylex.props(tableStyles.row)}>
              <td
                {...stylex.props(
                  tableStyles.cell,
                  tableStyles.first,
                  tableStyles.slot,
                  tableStyles.number
                )}
              >
                {crystal.slot ?? MISSING_VALUE}
              </td>
              <td {...stylex.props(tableStyles.cell)}>
                <div {...stylex.props(partStyles.item)}>
                  <ItemIcon itemId={crystal.itemId} rarity={crystal.rarity} />
                  <span {...stylex.props(partStyles.itemText)}>
                    <ItemName name={crystal.itemName} rarity={crystal.rarity} />
                    <TuneNumeral numeral={crystal.tune} />
                  </span>
                </div>
              </td>
              <td
                {...stylex.props(
                  tableStyles.cell,
                  tableStyles.end,
                  tableStyles.last,
                  tableStyles.number,
                  tableStyles.muted
                )}
              >
                {crystal.setPoint !== null ? formatPoint(crystal.setPoint) : MISSING_VALUE}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function OathEffects({
  view: { setStatus, blessing, upgrade }
}: {
  view: OathView
}): React.JSX.Element {
  return (
    <div {...stylex.props(styles.side)}>
      <StatSection title="서약 세트 효과" lines={setStatus} />
      <StatSection title="서약의 가호" lines={blessing} />
      {upgrade !== null && <StatSection title={upgrade.title} lines={upgrade.lines} />}
    </div>
  )
}

function StatSection({
  title,
  lines
}: {
  title: string | null
  lines: StatLine[]
}): React.JSX.Element | null {
  if (lines.length === 0) {
    return null
  }

  return (
    <section aria-label={title ?? undefined}>
      {title !== null && <h2 {...stylex.props(tableStyles.heading)}>{title}</h2>}
      <dl {...stylex.props(styles.list)}>
        {lines.map(({ name, value }, index) => (
          <div key={`${name}-${index}`} {...stylex.props(styles.line)}>
            <dt {...stylex.props(styles.term)}>{name}</dt>
            <dd {...stylex.props(styles.value)}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
