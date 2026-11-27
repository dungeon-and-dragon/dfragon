import { Fragment, type ReactNode } from 'react'

export type ItemDetailStatus = Readonly<{ name: string; value: string }>

export type ItemDetailCardOption = Readonly<{
  name: string
  values: readonly string[]
  emphasized: boolean
}>

export type ItemDetailCardOptions = Readonly<{
  slots: readonly string[]
  rows: readonly ItemDetailCardOption[]
}>

export type ItemDetail = Readonly<{
  name: string
  rarity: string | null
  availableLevel: number | null
  typeDetail: string | null
  fame: number | null
  status: readonly ItemDetailStatus[]
  explain: string | null
  flavorText: string | null
}>

export type ItemDetailCardProps = Readonly<{
  item: ItemDetail
  icon: ReactNode
  card: ItemDetailCardOptions | null
}>

const FAME_STATUS = '모험가 명성'
const SEPARATOR = '|'
const integer = new Intl.NumberFormat('ko-KR')

const RARITY_BY_NAME: Readonly<Record<string, string>> = {
  커먼: 'common',
  언커먼: 'uncommon',
  레어: 'rare',
  유니크: 'unique',
  에픽: 'epic',
  레전더리: 'legendary',
  크로니클: 'chronicle',
  태초: 'primordial',
  신화: 'mythic'
}

function emphasis(emphasized: boolean): '' | undefined {
  if (!emphasized) {
    return undefined
  }

  return ''
}

function CardOptions({ card }: { card: ItemDetailCardOptions }): React.JSX.Element {
  const stageCount = card.rows[0]?.values.length ?? 0
  // 이름 열 뒤로 단계 값과 구분자 열을 번갈아 두어 단계마다 값이 세로로 맞는다.
  const gridTemplateColumns = `max-content repeat(${Math.max(stageCount * 2 - 1, 1)}, max-content)`

  return (
    <div className="item-card-section item-card-enchant">
      <p data-card-slots="" className="item-card-slots">
        {card.slots.join(', ')}
      </p>
      <div className="item-card-options" style={{ gridTemplateColumns }}>
        {card.rows.map(({ name, values, emphasized }) => (
          <div key={name} data-card-option="" className="item-card-option">
            <span data-emphasized={emphasis(emphasized)} className="item-card-option-name">
              {name}
            </span>
            {values.map((value, index) => (
              <Fragment key={index}>
                {index > 0 && <span className="item-card-option-separator">{SEPARATOR}</span>}
                <span data-emphasized={emphasis(emphasized)} className="item-card-option-value num">
                  {value}
                </span>
              </Fragment>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function ItemDetailCard({ item, icon, card }: ItemDetailCardProps): React.JSX.Element {
  const status = item.status.filter(({ name }) => name !== FAME_STATUS)
  const rarity = item.rarity !== null ? RARITY_BY_NAME[item.rarity] : undefined

  return (
    <div className="item-card">
      <div className="item-card-head">
        {icon}
        <b data-rarity={rarity} className="item-card-name">
          {item.name}
        </b>
      </div>
      <div className="item-card-meta">
        {item.rarity !== null && (
          <span data-rarity={rarity} className="item-card-rarity">
            {item.rarity}
          </span>
        )}
        {item.availableLevel !== null && <span>{`레벨제한 ${item.availableLevel}`}</span>}
        {item.typeDetail !== null && <span>{item.typeDetail}</span>}
      </div>
      {item.fame !== null && (
        <p className="item-card-section item-card-fame">
          {`${FAME_STATUS} ${integer.format(item.fame)}`}
        </p>
      )}
      {status.length > 0 && (
        <ul className="item-card-status">
          {status.map(({ name, value }) => (
            <li key={name}>{`${name} ${value}`}</li>
          ))}
        </ul>
      )}
      {card !== null && <CardOptions card={card} />}
      {item.explain !== null && (
        <p className="item-card-section item-card-explain">{item.explain}</p>
      )}
      {item.flavorText !== null && <p className="item-card-flavor">{item.flavorText}</p>}
    </div>
  )
}
