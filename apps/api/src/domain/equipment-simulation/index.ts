export type { EquipmentChange } from './equipment.js'
export { editEquipment, needsMainStat, simulatedEquipment, wornMainStat } from './equipment.js'
export { EquipmentSimulationFailure } from './failure.js'
export type { EquipmentSimulationFailureKind } from './failure.js'
export type { SimulatedSlotItems, SlotItemChanges } from './slot-items.js'
export {
  editSlotItems,
  hasSlotItemEdits,
  simulatedSlotItems,
  simulationInputOf,
  slotItemIds,
  supportsSlotItems
} from './slot-items.js'
