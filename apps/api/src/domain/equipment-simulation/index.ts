export type { SimulationFeatures } from './engine-version.js'
export { supportsSimulation } from './engine-version.js'
export type { EquipmentChange } from './equipment.js'
export { editEquipment, needsMainStat, simulatedEquipment, wornMainStat } from './equipment.js'
export { editEquipmentItems, equipmentItemIds, withEquipmentItems } from './equipment-items.js'
export { EquipmentSimulationFailure } from './failure.js'
export type { EquipmentSimulationFailureKind } from './failure.js'
export type { OathTuneChange } from './oath.js'
export { editOathTunes, simulatedCrystals } from './oath.js'
export type { SimulatedSlotItems, SlotItemChanges } from './slot-items.js'
export {
  editSlotItems,
  hasSlotItemEdits,
  simulatedSlotItems,
  simulationInputOf,
  slotItemIds
} from './slot-items.js'
