import { Button, ChipGroup } from '@dfragon/ui'
import {
  type AdventureEquipment,
  type EquipmentSelection,
  toEquipmentBoard
} from '#entities/adventure-guild'
import { equipmentSetShortName } from '#entities/ranking'
import { serverNames } from '#shared/config/servers/servers'
import { AdventureTabs } from './AdventureTabs'
import { useAdventureEquipment, useRefreshAdventureEquipment } from './api/useAdventureEquipment'
import { EquipmentSection, EquipmentSkeleton, OathSection } from './EquipmentBoard'
import type { EquipmentSearch } from './equipment-search'

type Selection = Readonly<{ serverId: string; setItemId: string | undefined }>

function serverLabel(serverId: string): string {
  const names: Readonly<Record<string, string | undefined>> = serverNames
  const name = names[serverId]

  if (name === undefined) {
    return serverId
  }

  return name
}

// 칩은 누른 값을 바로 켜고, 표는 새 응답이 올 때까지 앞선 응답이 고른 서버, 세트를 보인다.
function chipSelection(
  equipment: AdventureEquipment,
  search: EquipmentSearch,
  selected: EquipmentSelection
): Selection {
  const server = equipment.servers.find(({ serverId }) => serverId === search.server)
  const set = equipment.sets.find(({ setItemId }) => setItemId === search.set)
  const serverId = server?.serverId ?? selected.serverId
  const setItemId = set?.setItemId ?? selected.setItemId ?? undefined

  return { serverId, setItemId }
}

function PickerRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <h3 className="label m-0 flex h-8 w-16 shrink-0 items-center">{label}</h3>
      {children}
    </div>
  )
}

function EquipmentPickers({
  equipment,
  selection,
  onChange
}: {
  equipment: AdventureEquipment
  selection: Selection
  onChange: (search: EquipmentSearch) => void
}): React.JSX.Element | null {
  const servers = equipment.servers.map(({ serverId }) => ({
    value: serverId,
    label: serverLabel(serverId)
  }))
  const sets = equipment.sets.map(({ setItemId, setItemName }) => ({
    value: setItemId,
    label: equipmentSetShortName(setItemId, setItemName)
  }))
  const { serverId, setItemId } = selection

  if (servers.length < 2 && setItemId === undefined) {
    return null
  }

  function changeServer(server: string): void {
    onChange({ server, set: setItemId })
  }

  function changeSet(set: string): void {
    onChange({ server: serverId, set })
  }

  return (
    <div className="section flex flex-col gap-3 bg-canvas px-4 sm:sticky sm:top-0 sm:z-sticky">
      {servers.length > 1 && (
        <PickerRow label="서버">
          <ChipGroup
            aria-label="서버"
            items={servers}
            value={serverId}
            onValueChange={changeServer}
          />
        </PickerRow>
      )}
      {setItemId !== undefined && (
        <PickerRow label="세트">
          <ChipGroup aria-label="세트" items={sets} value={setItemId} onValueChange={changeSet} />
        </PickerRow>
      )}
    </div>
  )
}

function EquipmentBody({
  adventureName,
  search,
  onSearchChange
}: {
  adventureName: string
  search: EquipmentSearch
  onSearchChange: (search: EquipmentSearch) => void
}): React.JSX.Element {
  const result = useAdventureEquipment(adventureName, search)
  const refresh = useRefreshAdventureEquipment()

  async function retry(): Promise<void> {
    await refresh(adventureName)
  }

  switch (result.status) {
    case 'loading':
      return (
        <section aria-label="장비" className="section min-w-0">
          <h2 className="section-title">장비</h2>
          <EquipmentSkeleton />
        </section>
      )
    case 'error':
      return (
        <section aria-label="장비" className="section min-w-0">
          <h2 className="section-title">장비</h2>
          <div className="state state-error flex-col gap-3">
            <p role="alert" className="m-0">
              장비를 받지 못했습니다.
            </p>
            <Button type="button" variant="secondary" size="sm" onClick={retry}>
              다시 시도
            </Button>
          </div>
        </section>
      )
    case 'success': {
      const equipment = result.value
      const { selected } = equipment

      if (selected === null) {
        return (
          <section aria-label="장비" className="section min-w-0">
            <h2 className="section-title">장비</h2>
            <p className="state">모험단 캐릭터가 없습니다.</p>
          </section>
        )
      }

      const characters =
        equipment.servers.find(({ serverId }) => serverId === selected.serverId)?.characters ?? []
      const rows = toEquipmentBoard(characters, selected.setItemId ?? undefined)
      const selection = chipSelection(equipment, search, selected)

      return (
        <>
          <EquipmentPickers equipment={equipment} selection={selection} onChange={onSearchChange} />
          <EquipmentSection rows={rows} />
          <OathSection rows={rows} />
        </>
      )
    }
  }
}

export function AdventureEquipmentScreen({
  adventureName,
  search,
  onSearchChange
}: {
  adventureName: string
  search: EquipmentSearch
  onSearchChange: (search: EquipmentSearch) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col">
      <AdventureTabs adventureName={adventureName} />
      <header className="section screen-head">
        <h1 className="screen-title">{adventureName}</h1>
      </header>
      <EquipmentBody
        adventureName={adventureName}
        search={search}
        onSearchChange={onSearchChange}
      />
    </div>
  )
}
