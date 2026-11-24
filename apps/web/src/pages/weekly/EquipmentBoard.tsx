import { Tooltip } from '@dfragon/ui'
import { Link } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import {
  EQUIPMENT_SLOTS,
  type EquipmentBoardRow,
  type EquipmentCharacter,
  HOLDING_RARITIES,
  type HoldingCell
} from '#entities/adventure-guild'
import {
  characterImageUrl,
  displayJobName,
  ItemIcon,
  ItemName,
  itemRarityOfGrade,
  Portrait,
  raritySolidOfName
} from '#entities/character'
import { MISSING_VALUE } from '#shared/lib/missing-value'
import { STICKY_HEAD, STICKY_HEAD_CELL, STICKY_TABLE_FRAME } from './sticky-head'

export const LOADING_ROWS = 4

const CHARACTER_COLUMN = 'w-[232px]'
const CRYSTAL_COLUMN = 'w-[112px]'
const SLOT_CELL = 'px-0 text-center'
const MISSING = <span className="text-fg-subtle">{MISSING_VALUE}</span>

function CharacterIdentity({ character }: { character: EquipmentCharacter }): React.JSX.Element {
  const image = characterImageUrl(character)
  const job = displayJobName(character, character.role)

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="portrait portrait-sm">
        <Portrait src={image} />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <Link
          to="/c/$serverId/$characterId"
          params={{ serverId: character.serverId, characterId: character.characterId }}
          className="link min-w-0 truncate text-sm font-semibold text-fg"
        >
          {character.characterName}
        </Link>
        {job != null && <span className="min-w-0 truncate text-xs text-fg-subtle">{job}</span>}
      </span>
    </div>
  )
}

function RarityCountTooltip({
  cell,
  children
}: {
  cell: HoldingCell
  children: ReactElement
}): React.JSX.Element {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger delay={0} closeDelay={0} render={children} />
      <Tooltip.Popup side="bottom" sideOffset={8}>
        <dl className="m-0 flex min-w-[120px] flex-col text-fg">
          {HOLDING_RARITIES.map((rarity, index) => (
            <div key={rarity} className="flex justify-between gap-4 py-1 text-xs">
              <dt className={raritySolidOfName(rarity)}>{rarity}</dt>
              <dd className="m-0 num text-fg-muted">{`${cell.rarityCounts[index] ?? 0}개`}</dd>
            </div>
          ))}
        </dl>
      </Tooltip.Popup>
    </Tooltip.Root>
  )
}

function HoldingIcon({ cell }: { cell: HoldingCell | null }): React.JSX.Element {
  if (cell === null) {
    return MISSING
  }

  return (
    <RarityCountTooltip cell={cell}>
      <span
        role="img"
        tabIndex={0}
        aria-label={`${cell.rarity} ${cell.itemName}`}
        className="relative inline-block align-middle focus-ring"
      >
        <ItemIcon itemId={cell.itemId} rarity={itemRarityOfGrade(cell.rarity)} />
        {cell.extraCount > 0 && (
          <span className="absolute -right-2 -bottom-1 flex h-4 min-w-4 items-center justify-center rounded-badge border border-line bg-canvas px-1 num text-2xs text-fg-muted">
            {`+${cell.extraCount}`}
          </span>
        )}
      </span>
    </RarityCountTooltip>
  )
}

function SlotColumns(): React.JSX.Element {
  return (
    <colgroup>
      <col className={CHARACTER_COLUMN} />
      {EQUIPMENT_SLOTS.map((slot) => (
        <col key={slot} />
      ))}
    </colgroup>
  )
}

function SlotHead({ sticky = false }: { sticky?: boolean }): React.JSX.Element {
  const cell = sticky ? STICKY_HEAD_CELL : ''

  return (
    <thead className={sticky ? STICKY_HEAD : undefined}>
      <tr>
        <th scope="col" className={cell}>
          캐릭터
        </th>
        {EQUIPMENT_SLOTS.map((slot) => (
          <th key={slot} scope="col" className={`${SLOT_CELL} ${cell}`}>
            {/* 900px 미만에서는 칸이 좁아 부위 이름이 겹치므로 숨긴다. */}
            <span className="max-md:hidden">{slot}</span>
          </th>
        ))}
      </tr>
    </thead>
  )
}

function EquipmentTable({ rows }: { rows: readonly EquipmentBoardRow[] }): React.JSX.Element {
  return (
    <div className="max-sm:hidden">
      <table className="table table-fixed">
        <SlotColumns />
        <SlotHead sticky />
        <tbody>
          {rows.map(({ character, slots }) => (
            <tr key={character.characterId}>
              <td className="py-0">
                <CharacterIdentity character={character} />
              </td>
              {slots.map(({ slot, cell }) => (
                <td key={slot} className={SLOT_CELL}>
                  <HoldingIcon cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EquipmentList({ rows }: { rows: readonly EquipmentBoardRow[] }): React.JSX.Element {
  return (
    <ul className="m-0 list-none p-0 sm:hidden">
      {rows.map(({ character, slots }) => (
        <li
          key={character.characterId}
          className="flex flex-col gap-3 border-t border-line px-4 py-3 first:border-t-0"
        >
          <CharacterIdentity character={character} />
          <div className="overflow-x-auto">
            <dl className="m-0 grid grid-cols-[repeat(6,52px)] gap-2 pb-1">
              {slots.map(({ slot, cell }) => (
                <div key={slot} className="flex flex-col items-center gap-1">
                  <dt className="text-xs text-fg-subtle">{slot}</dt>
                  <dd className="m-0">
                    <HoldingIcon cell={cell} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function EquipmentSection({
  rows
}: {
  rows: readonly EquipmentBoardRow[]
}): React.JSX.Element {
  return (
    <section aria-label="장비" className="section min-w-0">
      <h2 className="section-title">장비</h2>
      <EquipmentTable rows={rows} />
      <EquipmentList rows={rows} />
    </section>
  )
}

export function EquipmentSkeleton(): React.JSX.Element {
  return (
    <div className="table-scroll" aria-busy="true">
      <table className="table table-fixed">
        <SlotColumns />
        <SlotHead />
        <tbody>
          {Array.from({ length: LOADING_ROWS }, (_, index) => (
            <tr key={index} aria-hidden="true">
              <td className="py-0">
                <div className="flex items-center gap-3">
                  <span className="skeleton portrait-sm" />
                  <span className="skeleton-text w-[88px]" />
                </div>
              </td>
              {EQUIPMENT_SLOTS.map((slot) => (
                <td key={slot} className={SLOT_CELL}>
                  <span className="skeleton inline-block size-game-icon align-middle" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CrystalCount({ count, rarity }: { count: number; rarity: string }): React.JSX.Element {
  const tone = count > 0 ? `font-semibold ${raritySolidOfName(rarity) ?? ''}` : 'text-fg-subtle'

  return <td className={`table-num ${tone}`}>{count}</td>
}

export function OathSection({ rows }: { rows: readonly EquipmentBoardRow[] }): React.JSX.Element {
  return (
    <section aria-label="서약" className="section min-w-0">
      <h2 className="section-title">서약</h2>
      <div className={STICKY_TABLE_FRAME}>
        <table className="table table-fixed">
          <colgroup>
            <col className={CHARACTER_COLUMN} />
            <col />
            {HOLDING_RARITIES.map((rarity) => (
              <col key={rarity} className={CRYSTAL_COLUMN} />
            ))}
          </colgroup>
          <thead className={STICKY_HEAD}>
            <tr>
              <th scope="col" className={STICKY_HEAD_CELL}>
                캐릭터
              </th>
              <th scope="col" className={STICKY_HEAD_CELL}>
                서약
              </th>
              {HOLDING_RARITIES.map((rarity) => (
                <th key={rarity} scope="col" className={`table-num ${STICKY_HEAD_CELL}`}>
                  {`${rarity} 결정`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ character, oath, crystalCounts }) => (
              <tr key={character.characterId}>
                <td className="py-0">
                  <CharacterIdentity character={character} />
                </td>
                <td>
                  {oath !== null ? (
                    <RarityCountTooltip cell={oath}>
                      <span tabIndex={0} className="inline-flex max-w-full focus-ring">
                        <ItemName name={oath.itemName} rarity={itemRarityOfGrade(oath.rarity)} />
                      </span>
                    </RarityCountTooltip>
                  ) : (
                    MISSING
                  )}
                </td>
                {HOLDING_RARITIES.map((rarity, index) => (
                  <CrystalCount key={rarity} rarity={rarity} count={crystalCounts[index] ?? 0} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
