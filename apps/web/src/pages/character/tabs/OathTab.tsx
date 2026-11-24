import { CheckIcon } from '@dfragon/ui'
import {
  ItemIcon,
  ItemName,
  OATH_SET_POINT_BONUS,
  type OathUpgradeChoice,
  type OathView,
  RarityBadge,
  toOathView,
  raritySolidOf
} from '#entities/character'
import {
  GameText,
  type OathCatalog,
  type OathOptionCard,
  type OathSetBoard,
  oathItemIconOf,
  oathSetBoardOf,
  useOathCatalog
} from '#entities/catalog'
import type { CharacterTabProps } from './character-tab-props'
import { itemClasses, itemTableClasses } from './equipment/item-classes'
import { SetPoint, TuneNumeral } from './equipment/item-parts'

const { heading } = itemTableClasses
const UPGRADE_CHOICE_LABELS: Readonly<Record<OathUpgradeChoice, string>> = {
  finalDamage: '최종 데미지',
  cooldown: '쿨타임 감소',
  oathPoint: '서약 포인트',
  speed: '이동속도',
  range: '범위',
  defense: '방어력'
}

const UPGRADE_CHOICE_TONES: Readonly<Partial<Record<OathUpgradeChoice, string>>> = {
  finalDamage: 'text-game-decrease',
  cooldown: 'text-game-enhance'
}

const OPTION = 'm-0 flex items-start gap-4 rounded-control border p-4'
const OPTION_IDLE = 'border-dashed border-line-strong bg-canvas'
const OPTION_PICKED = 'border-solid border-signal bg-surface shadow-selected'

export function OathTab({ detail }: CharacterTabProps): React.JSX.Element | null {
  const catalog = useOathCatalog()
  if (detail.oath === null) {
    return null
  }

  const view = toOathView(detail.oath)
  const setInfo = detail.oath.setInfo
  const loaded = catalog.status === 'success' ? catalog.value : null
  const board = loaded !== null && setInfo !== null ? oathSetBoardOf(loaded, setInfo) : null

  // 600px 미만에서는 서약 탭의 모든 글자를 보통 굵기로 둔다.

  return (
    <div className={`${itemTableClasses.root} max-sm:[&_*]:font-normal`}>
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
      <div className="flex items-start max-md:flex-col">
        <div className="min-w-0 grow border-e border-line max-md:w-full max-md:border-e-0">
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
    <div className="flex items-center gap-6 border-b border-line p-4">
      <span
        className={`box-border flex size-[56px] shrink-0 items-center justify-center rounded-control border border-current bg-inset ${raritySolidOf(set.rarity)}`}
      >
        {board.icon !== null && (
          <img src={board.icon} alt="" className="size-[40px] [image-rendering:pixelated]" />
        )}
      </span>
      <span className="flex flex-wrap items-center gap-2 text-base">
        <ItemName name={set.name} rarity={set.rarity} />
        {set.rarityName !== null && <RarityBadge rarity={set.rarity}>{set.rarityName}</RarityBadge>}
        {set.point !== null && <SetPoint point={set.point} rule={OATH_SET_POINT_BONUS} />}
      </span>
    </div>
  )
}

function OathOptionCards({ options }: { options: readonly OathOptionCard[] }): React.JSX.Element {
  return (
    <div className="grid grid-cols-3 gap-3 border-b border-line p-4 max-sm:grid-cols-1">
      {options.map((option) => (
        <article
          key={option.name}
          aria-label={option.name}
          aria-current={option.picked || undefined}
          className={`${OPTION} ${option.picked ? OPTION_PICKED : OPTION_IDLE}`}
        >
          <div className="flex shrink-0 flex-col items-center gap-2">
            <img
              src={option.icon}
              alt=""
              className={`size-[46px] rounded-full ${option.picked ? '' : 'opacity-40 grayscale-80'}`}
            />
            {option.picked && (
              <span className="badge gap-1 bg-signal text-2xs font-semibold text-on-signal">
                <CheckIcon className="size-icon-sm" />
                선택
              </span>
            )}
          </div>
          {option.effect !== null && (
            <GameText lines={option.effect} className="min-w-0 grow text-xs leading-relaxed" />
          )}
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
      <div className="flex h-row items-center gap-3 border-b border-line px-4">
        <div className={itemClasses.item}>
          <ItemIcon itemId={info.itemId} src={oathItemIconOf(catalog, info)} rarity={info.rarity} />
          <ItemName name={info.itemName} rarity={info.rarity} />
        </div>
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
    <div className={itemClasses.strip}>
      {info !== null && (
        <span className={itemClasses.itemText}>
          <span className="label">서약</span>
          {icon !== null && <ItemIcon itemId={info.itemId} src={icon} rarity={info.rarity} />}
          <ItemName name={info.itemName} rarity={info.rarity} />
        </span>
      )}
      <span className={itemClasses.spacer} />
      {set !== null && (
        <span className={itemClasses.itemText}>
          <span className="label">서약 세트</span>
          <ItemName name={set.name} rarity={set.rarity} />
          {set.optionName !== null && (
            <span className={itemClasses.stripMuted}>{set.optionName}</span>
          )}
          {set.rarityName !== null && (
            <RarityBadge rarity={set.rarity}>{set.rarityName}</RarityBadge>
          )}
          {set.point !== null && <SetPoint point={set.point} rule={OATH_SET_POINT_BONUS} />}
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
      <table className="table">
        <thead>
          <tr>
            <th scope="col">결정</th>
          </tr>
        </thead>
        <tbody>
          {crystals.map((crystal, index) => (
            <tr key={`${crystal.slot}-${index}`}>
              <td>
                <div className={itemClasses.item}>
                  <ItemIcon itemId={crystal.itemId} rarity={crystal.rarity} />
                  <span className={itemClasses.itemText}>
                    <ItemName name={crystal.itemName} rarity={crystal.rarity} />
                    <TuneNumeral numeral={crystal.tune} />
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function OathEffects({ view: { upgrade } }: { view: OathView }): React.JSX.Element {
  return (
    <div className="w-[480px] shrink-0 max-md:w-full">
      {upgrade !== null && <UpgradeSection title={upgrade.title} steps={upgrade.steps} />}
    </div>
  )
}

function UpgradeSection({
  title,
  steps
}: {
  title: string | null
  steps: NonNullable<OathView['upgrade']>['steps']
}): React.JSX.Element {
  return (
    <section aria-label={title ?? undefined}>
      {title !== null && <h2 className={heading}>{title}</h2>}
      <dl>
        {steps.map(({ name, choice }) => (
          <div
            key={name}
            className="flex min-h-[40px] items-center justify-between gap-3 border-b border-line px-4"
          >
            <dt className="text-fg-muted">{name}</dt>
            <dd className={`font-semibold ${UPGRADE_CHOICE_TONES[choice] ?? ''}`}>
              {UPGRADE_CHOICE_LABELS[choice]}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
