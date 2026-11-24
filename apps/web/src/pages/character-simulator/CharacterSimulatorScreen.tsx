import { useCallback, useId, useMemo, useReducer, useState } from 'react'
import type { CharacterDetailView } from '#entities/character'
import { useCharacterDetail } from '#entities/character-detail'
import { LoadingLine } from '#shared/ui/LoadingLine'
import { useEquipmentSimulation } from './api/useEquipmentSimulation'
import { EquipmentList, OathList } from './components/EquipmentList'
import { SimulatorHeader } from './components/SimulatorHeader'
import { SimulatorSummaryBar } from './components/SimulatorSummaryBar'
import { SlotEditor, type SlotEditorActions } from './components/SlotEditor'
import { SlotEditorSheet } from './components/SlotEditorSheet'
import {
  hasChanges,
  NO_CHANGES,
  rowsInEquipmentSet,
  simulationBody,
  simulatorReducer,
  simulatorRole,
  toEquipmentSet,
  toSimulatorRows
} from './model/simulator-draft'
import { hasAvatarPreset } from './model/simulator-avatar'
import { oathInSet, toSimulatorOath } from './model/simulator-oath'
import {
  isOathTarget,
  selectedTargetOf,
  targetTitleOf,
  toSimulatorTargets
} from './model/simulator-target'
import { toSimulatorSwitching } from './model/simulator-switching'

const TITLE = '장비 시뮬레이터'
// 이 폭보다 좁으면 조작 패널을 숨기고 줄을 누를 때 시트로 연다. 디자인 토큰의 md 경계와 같다.
const NARROW_QUERY = '(width < 900px)'

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

// 요소가 창 안에 조금이라도 보이는지 알려 준다. 스크롤마다 위치를 재지 않고 경계를 넘을 때만 알림을 받는다.
function useInView(): [(node: HTMLElement | null) => (() => void) | undefined, boolean] {
  const [inView, setInView] = useState(true)
  const watch = useCallback((node: HTMLElement | null) => {
    if (node === null) {
      return undefined
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        setInView(entry.isIntersecting)
      }
    })

    observer.observe(node)

    return () => observer.disconnect()
  }, [])

  return [watch, inView]
}

function Simulator({ detail }: { detail: CharacterDetailView }): React.JSX.Element {
  const { character } = detail
  const identity = { serverId: character.serverId, characterId: character.characterId }
  const wornRows = useMemo(() => toSimulatorRows(detail), [detail])
  const equipmentSet = useMemo(() => toEquipmentSet(detail), [detail])
  const wornOath = useMemo(() => toSimulatorOath(detail), [detail])
  const avatarPresetAvailable = useMemo(
    () => hasAvatarPreset(detail, simulatorRole(detail.card)),
    [detail]
  )
  const switching = useMemo(
    () => toSimulatorSwitching(detail, simulatorRole(detail.card)),
    [detail]
  )
  const [changes, dispatch] = useReducer(simulatorReducer, NO_CHANGES)
  const rows = useMemo(
    () => rowsInEquipmentSet(wornRows, changes.equipmentSet),
    [wornRows, changes.equipmentSet]
  )
  const oath = useMemo(
    () => (wornOath !== null ? oathInSet(wornOath, changes.oath.set) : null),
    [wornOath, changes.oath.set]
  )
  const targets = useMemo(
    () => toSimulatorTargets(equipmentSet, rows, avatarPresetAvailable, switching, oath),
    [equipmentSet, rows, avatarPresetAvailable, switching, oath]
  )
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const body = useMemo(() => simulationBody(rows, oath, changes), [rows, oath, changes])
  const simulation = useEquipmentSimulation(identity, body)
  const equipmentHeadingId = useId()
  const oathHeadingId = useId()
  const selected = selectedTargetOf(targets, selectedKey)
  const [watchHeader, headerInView] = useInView()
  const actions: SlotEditorActions = {
    onEquipmentSetChange: (set, setItemId) =>
      dispatch({ type: 'equipmentSet', rows: wornRows, equipmentSet: set, setItemId }),
    onChange: (slot, draft) => dispatch({ type: 'change', slot, draft }),
    onSlotItemChange: (slotItem, id) => dispatch({ type: 'slotItem', slotItem, id }),
    onAvatarPresetChange: (preset) => dispatch({ type: 'avatarPreset', preset }),
    onBuffLevelChange: (buffSwitching, level) =>
      dispatch({ type: 'buffLevel', switching: buffSwitching, level }),
    onSwitchingEquipmentChange: (buffSwitching, count) =>
      dispatch({ type: 'switchingEquipment', switching: buffSwitching, count }),
    onOathSetChange: (setId) => {
      if (wornOath !== null) {
        dispatch({ type: 'oathSet', oath: wornOath, setId })
      }
    },
    onOathBodyChange: (oathBody, id) => dispatch({ type: 'oathBody', body: oathBody, id }),
    onOathUpgradeUnlockChange: (upgrade, step, unlocked) =>
      dispatch({ type: 'oathUpgradeUnlock', upgrade, step, unlocked }),
    onOathUpgradeOathpointChange: (upgrade, step, oathpoint) =>
      dispatch({ type: 'oathUpgradeOathpoint', upgrade, step, oathpoint }),
    onCrystalChange: (crystal, draft) => {
      if (oath !== null) {
        dispatch({ type: 'crystal', oath, crystal, draft })
      }
    }
  }

  function select(key: string): void {
    setSelectedKey(key)
    setSheetOpen(window.matchMedia(NARROW_QUERY).matches)
  }

  function reset(): void {
    dispatch({ type: 'reset' })
  }

  const hasOathRows = targets.some(isOathTarget)
  const editor = selected !== undefined && (
    <SlotEditor target={selected} oath={oath} changes={changes} actions={actions} />
  )

  return (
    // 위에 붙는 요약 줄의 높이다. 조작 패널은 요약 줄 아래에 붙고, 선택 버튼이 길면 창 높이 안에서 따로 스크롤한다.
    // 900px 미만에서는 요약 줄이 서버와 이름, 점수의 두 줄이다.
    <div className="flex flex-col [--summary-height:var(--height-row)] max-md:[--summary-height:calc(var(--height-row)+var(--spacing-6))]">
      <div ref={watchHeader}>
        <SimulatorHeader
          title={TITLE}
          detail={detail}
          simulation={simulation}
          changed={hasChanges(changes)}
          onReset={reset}
        />
      </div>
      <SimulatorSummaryBar shown={!headerInView} detail={detail} simulation={simulation} />
      <div className="section grid grid-cols-[320px_minmax(0,1fr)] items-start py-0 max-md:grid-cols-1">
        <aside
          aria-label={selected !== undefined ? targetTitleOf(selected) : undefined}
          className="min-w-0 md:sticky md:top-[var(--summary-height)] md:max-h-[calc(100dvh-var(--summary-height))] md:overflow-y-auto max-md:hidden"
        >
          {selected !== undefined && (
            <div className="section-title">
              <h2>{targetTitleOf(selected)}</h2>
            </div>
          )}
          {editor}
        </aside>
        <div className="min-w-0 border-l border-line max-md:border-l-0">
          <section aria-labelledby={equipmentHeadingId}>
            <div className="section-title">
              <h2 id={equipmentHeadingId}>장비</h2>
            </div>
            <EquipmentList
              rows={rows}
              targets={targets}
              changes={changes}
              selectedKey={selected?.key}
              onSelect={select}
            />
          </section>
          {hasOathRows && (
            <section aria-labelledby={oathHeadingId} className="border-t border-line">
              <div className="section-title">
                <h2 id={oathHeadingId}>서약</h2>
              </div>
              <OathList
                targets={targets}
                changes={changes}
                selectedKey={selected?.key}
                onSelect={select}
              />
            </section>
          )}
        </div>
      </div>
      <SlotEditorSheet
        open={sheetOpen}
        title={selected !== undefined ? targetTitleOf(selected) : ''}
        onOpenChange={setSheetOpen}
      >
        {editor}
      </SlotEditorSheet>
    </div>
  )
}
