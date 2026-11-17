import type { GameTextTone } from '#core/catalog/game-text'

export const gameTextToneClasses: Readonly<Record<GameTextTone, string>> = {
  default: '',
  increase: 'text-game-increase',
  decrease: 'text-game-decrease',
  amplify: 'text-game-amplify',
  enhance: 'text-game-enhance',
  refine: 'text-game-refine',
  set: 'text-game-set',
  disabled: 'text-fg-subtle',
  'rarity-rare': 'text-rarity-rare',
  'rarity-unique': 'text-rarity-unique',
  'rarity-epic': 'text-rarity-epic',
  'rarity-legendary': 'text-rarity-legendary',
  'rarity-chronicle': 'text-rarity-chronicle',
  'rarity-primordial': 'bg-(image:--gradient-rarity-primordial) bg-clip-text text-transparent'
}
