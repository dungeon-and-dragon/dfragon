import { ItemIcon, ItemName } from '#entities/character'
import {
  oathTuneOf,
  type SimulatorChanges,
  type SimulatorOathCrystal
} from '#pages/character-simulator/model/simulator-draft'
import { TuneSelect } from './TuneSelect'

export function OathCrystalTable({
  crystals,
  changes,
  onTuneChange
}: {
  crystals: readonly SimulatorOathCrystal[]
  changes: SimulatorChanges
  onTuneChange: (crystal: SimulatorOathCrystal, tune: number) => void
}): React.JSX.Element {
  return (
    <table className="table table-wrap table-fixed">
      <thead>
        <tr>
          <th scope="col">결정</th>
          <th scope="col" className="w-[96px]">
            조율
          </th>
        </tr>
      </thead>
      <tbody>
        {crystals.map((crystal) => (
          <OathCrystalRow
            key={crystal.slotNo}
            crystal={crystal}
            tune={oathTuneOf(crystal, changes)}
            onTuneChange={onTuneChange}
          />
        ))}
      </tbody>
    </table>
  )
}

function OathCrystalRow({
  crystal,
  tune,
  onTuneChange
}: {
  crystal: SimulatorOathCrystal
  tune: number
  onTuneChange: (crystal: SimulatorOathCrystal, tune: number) => void
}): React.JSX.Element {
  function changeTune(next: number): void {
    onTuneChange(crystal, next)
  }

  return (
    <tr>
      <td>
        <div className="flex min-w-0 items-center gap-3">
          <ItemIcon itemId={crystal.itemId} rarity={crystal.rarity} />
          <ItemName name={crystal.itemName} rarity={crystal.rarity} />
        </div>
      </td>
      <td>
        {crystal.maxTune > 0 && (
          <TuneSelect
            label={`결정 ${crystal.slotNo + 1} 조율`}
            tune={tune}
            maxTune={crystal.maxTune}
            onChange={changeTune}
          />
        )}
      </td>
    </tr>
  )
}
