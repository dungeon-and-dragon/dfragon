import { findWeaponVariant, type WeaponVariantLine } from '@dfragon/lib/equipment-variants'
import {
  formatCount,
  ItemIcon,
  itemRarityOfGrade,
  rarityTextOfName,
  tuneNumeral
} from '#entities/character'
import type { EpicSoulSlot } from '#pages/lab-epic-souls/model/epic-soul-recovery'

const WEAPON_SLOT_ID = 'WEAPON'
// 캐릭터 상세 장비 탭과 같은 부위 이름이다.
const SLOT_NAMES: Readonly<Record<string, string>> = {
  WEAPON: '무기',
  JACKET: '상의',
  SHOULDER: '머리어깨',
  PANTS: '하의',
  SHOES: '신발',
  WAIST: '벨트',
  AMULET: '목걸이',
  WRIST: '팔찌',
  RING: '반지',
  SUPPORT: '보조장비',
  MAGIC_STON: '마법석',
  EARRING: '귀걸이'
}
// 장비 시뮬레이터처럼 무기는 아이템 이름 대신 계열 이름으로 부른다.
const WEAPON_LINE_NAMES: Readonly<Record<WeaponVariantLine, string>> = {
  기본: '레거시',
  해방: '디거시',
  '태초의 별': '태초의 별'
}

function isWeaponLine(line: string): line is WeaponVariantLine {
  return Object.hasOwn(WEAPON_LINE_NAMES, line)
}

function wornNameOf({ slotId, itemId, itemName }: EpicSoulSlot): string {
  const line = slotId === WEAPON_SLOT_ID ? findWeaponVariant(itemId)?.variant.line : undefined

  if (line == null || !isWeaponLine(line)) {
    return itemName
  }

  return WEAPON_LINE_NAMES[line]
}

function ItemCell({
  itemId,
  name,
  rarity,
  tune
}: {
  itemId: string
  name: string
  rarity: string
  tune: number
}): React.JSX.Element {
  const numeral = tuneNumeral(tune)

  return (
    <div className="flex min-w-0 items-center gap-2">
      <ItemIcon itemId={itemId} rarity={itemRarityOfGrade(rarity)} />
      <span className={`min-w-0 truncate ${rarityTextOfName(rarity) ?? ''}`}>{name}</span>
      {numeral !== null && <span className="shrink-0 text-fg-muted">{numeral}</span>}
    </div>
  )
}

export function EpicSoulSlotTable({
  slots
}: {
  slots: readonly EpicSoulSlot[]
}): React.JSX.Element {
  return (
    <table className="table table-fixed max-w-[720px]">
      <colgroup>
        <col className="w-[96px]" />
        <col />
        <col className="w-[96px]" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">부위</th>
          <th scope="col">장비</th>
          <th scope="col" className="table-num">
            에픽 소울
          </th>
        </tr>
      </thead>
      <tbody>
        {slots.map((slot) => {
          const { slotId, itemId, itemRarity, tune, souls } = slot

          return (
            <tr key={slotId}>
              <th scope="row" className="font-normal">
                {SLOT_NAMES[slotId] ?? slotId}
              </th>
              <td>
                <ItemCell itemId={itemId} name={wornNameOf(slot)} rarity={itemRarity} tune={tune} />
              </td>
              <td className="table-num font-semibold">{formatCount(souls)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
