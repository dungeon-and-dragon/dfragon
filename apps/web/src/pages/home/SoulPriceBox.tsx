import { ItemIcon, itemRarityOfGrade } from '#entities/character'
import { MISSING_VALUE } from '#shared/lib/missing-value'
import { ListBox } from '#shared/ui/ListBox'
import { type SoulPrice, useSoulPrices } from './api/useSoulPrices'

const NAME = '소울 결정 가격'
const SKELETON_COUNT = 6
const integer = new Intl.NumberFormat('ko-KR')

function goldOf(value: number | null): string {
  if (value === null) {
    return MISSING_VALUE
  }

  return integer.format(value)
}

function goldPerRevelation({ unitPrice, revelationCount }: SoulPrice): number | null {
  if (unitPrice === null) {
    return null
  }

  return Math.round(unitPrice / revelationCount)
}

export function SoulPriceBox(): React.JSX.Element {
  return (
    <div className="min-w-0 flex-[1_1_400px]">
      <SoulPrices />
    </div>
  )
}

function SoulPrices(): React.JSX.Element {
  const result = useSoulPrices()

  switch (result.status) {
    case 'loading':
      return (
        <ListBox name={NAME}>
          <div aria-busy="true">
            <span role="status" className="sr-only">
              가격을 받는 중입니다.
            </span>
            <SoulPriceTable>
              {Array.from({ length: SKELETON_COUNT }, (_, index) => (
                <SkeletonRow key={index} />
              ))}
            </SoulPriceTable>
          </div>
        </ListBox>
      )
    case 'error':
      return (
        <ListBox name={NAME}>
          <p role="alert" className="state state-error">
            {result.message}
          </p>
        </ListBox>
      )
    case 'success':
      return (
        <ListBox name={NAME}>
          <SoulPriceTable>
            {result.value.map((crystal) => (
              <tr key={crystal.itemName}>
                <td>
                  <span title={crystal.itemName} className="inline-block align-middle">
                    <ItemIcon
                      itemId={crystal.itemId}
                      rarity={itemRarityOfGrade(crystal.itemRarity)}
                    />
                    <span className="sr-only">{crystal.itemName}</span>
                  </span>
                </td>
                <td className="table-num">{goldOf(crystal.unitPrice)}</td>
                <td className="table-num font-semibold">{goldOf(goldPerRevelation(crystal))}</td>
              </tr>
            ))}
          </SoulPriceTable>
        </ListBox>
      )
  }
}

function SoulPriceTable({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">소울 결정</span>
            </th>
            <th scope="col" className="table-num">
              가격
            </th>
            <th scope="col" className="table-num">
              계시 환산
            </th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function SkeletonRow(): React.JSX.Element {
  return (
    <tr aria-hidden>
      <td>
        <span className="skeleton inline-block size-game-icon align-middle" />
      </td>
      <td className="table-num">
        <span className="skeleton-text ml-auto w-[64px]" />
      </td>
      <td className="table-num">
        <span className="skeleton-text ml-auto w-[56px]" />
      </td>
    </tr>
  )
}
