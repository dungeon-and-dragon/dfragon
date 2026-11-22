import { Button } from '@dfragon/ui'
import { Link } from '@tanstack/react-router'
import { useId, useMemo, useReducer } from 'react'
import { type CharacterDetailView, ServerBadge } from '#entities/character'
import { useCharacterDetail } from '#entities/character-detail'
import { MISSING_VALUE } from '#shared/lib/missing-value'
import { LoadingLine } from '#shared/ui/LoadingLine'
import { useEquipmentSimulation } from './api/useEquipmentSimulation'
import { ScorePanel } from './components/ScorePanel'
import { SimulatorTable } from './components/SimulatorTable'
import {
  hasChanges,
  NO_CHANGES,
  type SimulatorSlot,
  type SimulatorSlotItem,
  type SlotDraft,
  simulationBody,
  simulatorReducer,
  toSimulatorRows
} from './model/simulator-draft'

const TITLE = '장비 시뮬레이터'

export function CharacterSimulatorScreen({
  serverId,
  characterId
}: {
  serverId: string
  characterId: string
}): React.JSX.Element {
  const result = useCharacterDetail(serverId, characterId)

  switch (result.status) {
    case 'loading':
      return (
        <div className="flex flex-col">
          <header className="section screen-head">
            <h1 className="screen-title">{TITLE}</h1>
          </header>
          <div aria-busy="true" className="section state state-pending">
            <LoadingLine />
            <span role="status">캐릭터 정보를 받는 중입니다.</span>
          </div>
        </div>
      )
    case 'error':
      return (
        <div className="flex flex-col">
          <header className="section screen-head">
            <h1 className="screen-title">{TITLE}</h1>
          </header>
          <div className="section">
            <p role="alert" className="state state-error">
              {result.message}
            </p>
          </div>
        </div>
      )
    case 'success':
      return <Simulator key={`${serverId}/${characterId}`} detail={result.detail} />
  }
}

function Simulator({ detail }: { detail: CharacterDetailView }): React.JSX.Element {
  const { character } = detail
  const identity = { serverId: character.serverId, characterId: character.characterId }
  const rows = useMemo(() => toSimulatorRows(detail), [detail])
  const [changes, dispatch] = useReducer(simulatorReducer, NO_CHANGES)
  const body = useMemo(() => simulationBody(rows, changes), [rows, changes])
  const simulation = useEquipmentSimulation(identity, body)
  const equipmentHeadingId = useId()

  function change(slot: SimulatorSlot, draft: Partial<SlotDraft>): void {
    dispatch({ type: 'change', slot, draft })
  }

  function changeSlotItem(slotItem: SimulatorSlotItem, id: string | null): void {
    dispatch({ type: 'slotItem', slotItem, id })
  }

  function reset(): void {
    dispatch({ type: 'reset' })
  }

  return (
    <div className="flex flex-col">
      <header className="section screen-head">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="screen-title">{TITLE}</h1>
          <div className="flex min-w-0 items-center gap-2">
            <ServerBadge serverId={character.serverId} />
            <Link
              to="/c/$serverId/$characterId"
              params={identity}
              className="link min-w-0 truncate font-semibold text-fg"
            >
              {character.characterName ?? MISSING_VALUE}
            </Link>
          </div>
        </div>
      </header>
      <div className="section grid grid-cols-[minmax(0,1fr)_280px] items-start py-0 max-md:grid-cols-1">
        <section
          aria-labelledby={equipmentHeadingId}
          className="min-w-0 border-r border-line max-md:border-r-0 max-md:border-t"
        >
          <div className="section-title">
            <h2 id={equipmentHeadingId}>장비</h2>
            <span className="section-title-actions">
              <Button size="sm" disabled={!hasChanges(changes)} onClick={reset}>
                초기화
              </Button>
            </span>
          </div>
          <SimulatorTable
            rows={rows}
            changes={changes}
            onChange={change}
            onSlotItemChange={changeSlotItem}
          />
        </section>
        <div className="md:sticky md:top-0 max-md:order-first">
          <ScorePanel role={detail.card?.role ?? null} result={simulation} />
        </div>
      </div>
    </div>
  )
}
