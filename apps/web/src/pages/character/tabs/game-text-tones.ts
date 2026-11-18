import type { GameTextTone } from '#core/catalog'
import { enhancementTextClasses, rarityTextClasses } from '../../../components/game-colors'

export const gameTextToneClasses: Readonly<Record<GameTextTone, string>> = {
  default: '',
  increase: 'text-game-increase',
  decrease: 'text-game-decrease',
  ...enhancementTextClasses,
  set: 'text-game-set',
  disabled: 'text-fg-subtle',
  'rarity-rare': rarityTextClasses.rare,
  'rarity-unique': rarityTextClasses.unique,
  'rarity-epic': rarityTextClasses.epic,
  'rarity-legendary': rarityTextClasses.legendary,
  'rarity-chronicle': rarityTextClasses.chronicle,
  'rarity-primordial': rarityTextClasses.primordial
}
