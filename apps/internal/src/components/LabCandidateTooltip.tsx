import type { EnchantGradeRole } from '@dfragon/lib/enchant-grades'
import { cardOptionRows } from '@dfragon/lib/enchant-options'
import { type ItemDetail, ItemDetailCard, type ItemDetailCardOptions, Tooltip } from '@dfragon/ui'
import type { ReactElement, ReactNode } from 'react'
import type { LabCandidate, LabItemCard } from '#ops-api/ops-schemas'

function detailOf(candidate: LabCandidate): ItemDetail {
  // 마법부여 카드는 옵션 줄 대신 카드 단계별 옵션을 보인다.
  const status = candidate.card !== null ? [] : candidate.options

  return {
    name: candidate.itemName,
    rarity: candidate.itemRarity,
    availableLevel: candidate.availableLevel,
    typeDetail: candidate.itemTypeDetail,
    fame: candidate.fame,
    status,
    explain: candidate.description,
    flavorText: null
  }
}

function cardOptionsOf(card: LabItemCard, role: EnchantGradeRole): ItemDetailCardOptions {
  const enchants = card.enchants.map(({ status }) => ({ status, reinforceSkill: [] }))
  const rows = cardOptionRows({ enchants }, role)

  return { slots: card.slots, rows }
}

export function LabCandidateTooltip({
  candidate,
  role,
  icon,
  children
}: {
  candidate: LabCandidate
  role: EnchantGradeRole
  icon: ReactNode
  children: ReactElement
}): React.JSX.Element {
  const card = candidate.card !== null ? cardOptionsOf(candidate.card, role) : null

  return (
    <Tooltip.Root>
      <Tooltip.Trigger delay={0} closeDelay={0} render={children} />
      <Tooltip.Popup side="right" align="start" sideOffset={8}>
        <div className="tooltip-item">
          <ItemDetailCard
            item={detailOf(candidate)}
            icon={icon}
            card={card}
            buffs={candidate.buffLines}
          />
        </div>
      </Tooltip.Popup>
    </Tooltip.Root>
  )
}
