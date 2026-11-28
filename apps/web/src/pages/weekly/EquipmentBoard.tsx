import { Tooltip } from '@dfragon/ui'
import { Link } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import {
  type CrystalCell,
  EQUIPMENT_SLOTS,
  type EquipmentBoardRow,
  type EquipmentCharacter,
  HOLDING_RARITIES,
  type HoldingCell
} from '#entities/adventure-guild'
import { oathItemIconOf, useOathCatalog } from '#entities/catalog'
import {
  characterImageUrl,
  displayJobName,
  ItemIcon,
  itemRarityOfGrade,
  Portrait,
  raritySolidOfName
} from '#entities/character'
import { STICKY_HEAD, STICKY_HEAD_CELL, STICKY_TABLE_FRAME } from './sticky-head'

export const LOADING_ROWS = 4

const CHARACTER_COLUMN = 'w-[232px]'
const CRYSTAL_COLUMN = 'w-[160px]'
const CRYSTAL_ICON_LIMIT = 3
const SLOT_CELL = 'px-0 text-center'

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

function HoldingIcon({
  cell,
  src
}: {
  cell: HoldingCell | null
  src?: string | null
}): React.JSX.Element | null {
  if (cell === null) {
    return null
  }

  return (
    <RarityCountTooltip cell={cell}>
      <span
        role="img"
        tabIndex={0}
        aria-label={`${cell.rarity} ${cell.itemName}`}
        className="relative inline-block align-middle focus-ring"
      >
        {/* 서약 본체는 Neople 그림이 없어 실패한 뒤 카탈로그 그림이 오므로, src가 바뀌면 실패 상태를 버리고 다시 그린다. */}
        <ItemIcon
          key={src ?? cell.itemId}
          itemId={cell.itemId}
          src={src}
          rarity={itemRarityOfGrade(cell.rarity)}
        />
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

function CrystalIcons({ crystal }: { crystal: CrystalCell | null }): React.JSX.Element | null {
  if (crystal === null) {
    return null
  }

  const rarity = itemRarityOfGrade(crystal.rarity)
  const shown = Math.min(crystal.count, CRYSTAL_ICON_LIMIT)
  const extraCount = crystal.count - shown

  return (
    <span
      role="img"
      aria-label={`${crystal.itemName} ${crystal.count}개`}
      className="inline-flex items-center gap-1 align-middle"
    >
      {Array.from({ length: shown }, (_, index) => (
        <ItemIcon key={index} itemId={crystal.itemId} rarity={rarity} />
      ))}
      {extraCount > 0 && <span className="num text-xs text-fg-muted">{`+${extraCount}`}</span>}
    </span>
  )
}

function useOathIconOf(): (cell: HoldingCell) => string | null {
  const catalog = useOathCatalog()
  const loaded = catalog.status === 'success' ? catalog.value : null

  return (cell) => {
    if (loaded === null) {
      return null
    }

    const rarity = itemRarityOfGrade(cell.rarity)
    const item = { itemId: cell.itemId, itemName: cell.itemName, rarity }

    return oathItemIconOf(loaded, item)
  }
}

export function OathSection({ rows }: { rows: readonly EquipmentBoardRow[] }): React.JSX.Element {
  const oathIconOf = useOathIconOf()

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
                <th key={rarity} scope="col" className={STICKY_HEAD_CELL}>
                  {`${rarity} 결정`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ character, oath, crystals }) => (
              <tr key={character.characterId}>
                <td className="py-0">
                  <CharacterIdentity character={character} />
                </td>
                <td>
                  <HoldingIcon cell={oath} src={oath !== null ? oathIconOf(oath) : null} />
                </td>
                {HOLDING_RARITIES.map((rarity, index) => (
                  <td key={rarity}>
                    <CrystalIcons crystal={crystals[index] ?? null} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
