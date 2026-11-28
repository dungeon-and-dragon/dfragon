import { Tooltip } from '@dfragon/ui'
import type { ReactElement } from 'react'
import { EVOLUTION_NUMERALS, type EvolutionBranch } from '#entities/catalog/model/skill-window'
import { GameText } from './GameText'

export function EvolutionBranchTooltip({
  branch,
  children
}: {
  branch: EvolutionBranch
  children: ReactElement
}): React.JSX.Element {
  return (
    // 설명 창이 아래 갈래를 덮으므로, 마우스가 설명 창으로 옮겨 가면 닫아 다른 갈래를 볼 수 있게 한다.
    <Tooltip.Root disableHoverablePopup>
      <Tooltip.Trigger delay={0} closeDelay={0} render={children} />
      <Tooltip.Popup side="bottom" align="end">
        <span className="flex w-[340px] flex-col gap-2 py-1 text-xs leading-relaxed break-keep whitespace-normal">
          <b className="font-semibold">{`${EVOLUTION_NUMERALS[branch.type]} ${branch.name}`}</b>
          <GameText lines={branch.basicExplain} className="text-fg-muted" />
          <GameText lines={branch.explain} />
        </span>
      </Tooltip.Popup>
    </Tooltip.Root>
  )
}
