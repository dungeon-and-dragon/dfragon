import * as stylex from '@stylexjs/stylex'

// StyleX compiler는 import 경로가 .stylex로 끝나는 파일의 defineConsts만 다른 파일에서 읽는다.
// 값은 tokens.css의 --df-* 변수 참조이므로 모드 전환은 CSS만으로 끝나고 런타임 테마가 없다.

export const colors = stylex.defineConsts({
  bgCanvas: 'var(--df-bg-canvas)',
  bgBar: 'var(--df-bg-bar)',
  bgSurface: 'var(--df-bg-surface)',
  bgInset: 'var(--df-bg-inset)',
  bgStripe: 'var(--df-bg-stripe)',
  bgControl: 'var(--df-bg-control)',
  bgControlHover: 'var(--df-bg-control-hover)',
  bgSuccessWeak: 'var(--df-bg-success-weak)',
  bgDangerWeak: 'var(--df-bg-danger-weak)',
  bgWarningWeak: 'var(--df-bg-warning-weak)',
  bgOverlay: 'var(--df-bg-overlay)',
  signal: 'var(--df-signal)',
  signalHover: 'var(--df-signal-hover)',
  onSignal: 'var(--df-on-signal)',
  accent: 'var(--df-accent)',
  brandLogo: 'var(--df-brand-logo)',
  fgDefault: 'var(--df-fg-default)',
  fgMuted: 'var(--df-fg-muted)',
  fgSubtle: 'var(--df-fg-subtle)',
  fgPlaceholder: 'var(--df-fg-placeholder)',
  fgDisabled: 'var(--df-fg-disabled)',
  fgSuccess: 'var(--df-fg-success)',
  fgDanger: 'var(--df-fg-danger)',
  fgWarning: 'var(--df-fg-warning)',
  fgAdventure: 'var(--df-fg-adventure)',
  fgGuild: 'var(--df-fg-guild)',
  borderDefault: 'var(--df-border-default)',
  borderStrong: 'var(--df-border-strong)',
  borderInput: 'var(--df-border-input)',
  borderDanger: 'var(--df-border-danger)',
  tierTop: 'var(--df-tier-top)',
  tierRanker: 'var(--df-tier-ranker)',
  scoreDealer: 'var(--df-score-dealer)',
  scoreBuffer: 'var(--df-score-buffer)',
  cardControl: 'var(--df-card-control)',
  cardControlHover: 'var(--df-card-control-hover)',
  cardBorder: 'var(--df-card-border)',
  cardBorderStrong: 'var(--df-card-border-strong)',
  cardFg: 'var(--df-card-fg)',
  cardFgMuted: 'var(--df-card-fg-muted)',
  cardFgSubtle: 'var(--df-card-fg-subtle)',
  cardSignal: 'var(--df-card-signal)',
  cardFailure: 'var(--df-card-failure)',
  brandDragon: 'var(--df-brand-dragon)',
  brandCream: 'var(--df-brand-cream)',
  brandOutline: 'var(--df-brand-outline)',
  rarityCommon: 'var(--df-rarity-common)',
  rarityUncommon: 'var(--df-rarity-uncommon)',
  rarityRare: 'var(--df-rarity-rare)',
  rarityUnique: 'var(--df-rarity-unique)',
  rarityEpic: 'var(--df-rarity-epic)',
  rarityLegendary: 'var(--df-rarity-legendary)',
  rarityChronicle: 'var(--df-rarity-chronicle)',
  rarityPrimordial: 'var(--df-rarity-primordial)',
  rarityPrimordialGradient: 'var(--df-rarity-primordial-gradient)',
  rarityMythic: 'var(--df-rarity-mythic)',
  rarityMythicGradient: 'var(--df-rarity-mythic-gradient)',
  oathRare: 'var(--df-oath-rare)',
  oathRareGradient: 'var(--df-oath-rare-gradient)',
  oathUnique: 'var(--df-oath-unique)',
  oathUniqueGradient: 'var(--df-oath-unique-gradient)',
  oathLegendary: 'var(--df-oath-legendary)',
  oathLegendaryGradient: 'var(--df-oath-legendary-gradient)',
  oathEpic: 'var(--df-oath-epic)',
  oathEpicGradient: 'var(--df-oath-epic-gradient)',
  gameEnhance: 'var(--df-game-enhance)',
  gameRefine: 'var(--df-game-refine)',
  gameAmplify: 'var(--df-game-amplify)',
  gameEnchant: 'var(--df-game-enchant)',
  gameSet: 'var(--df-game-set)',
  gameIncrease: 'var(--df-game-increase)',
  gameFame: 'var(--df-game-fame)',
  gameDecrease: 'var(--df-game-decrease)',
  gamePrecision: 'var(--df-game-precision)',
  gameFameLabel: 'var(--df-game-fame-label)',
  raidPartyRed: 'var(--df-raid-party-red)',
  raidPartyRedWeak: 'var(--df-raid-party-red-weak)',
  raidPartyYellow: 'var(--df-raid-party-yellow)',
  raidPartyYellowWeak: 'var(--df-raid-party-yellow-weak)',
  raidPartyGreen: 'var(--df-raid-party-green)',
  raidPartyGreenWeak: 'var(--df-raid-party-green-weak)'
})

export const shadow = stylex.defineConsts({
  popover: 'var(--df-shadow-popover)',
  tooltip: 'var(--df-shadow-tooltip)'
})

export const space = stylex.defineConsts({
  s4: 'var(--df-space-4)',
  s8: 'var(--df-space-8)',
  s12: 'var(--df-space-12)',
  s16: 'var(--df-space-16)',
  s24: 'var(--df-space-24)'
})

export const radius = stylex.defineConsts({
  panel: 'var(--df-radius-panel)',
  control: 'var(--df-radius-control)'
})

export const size = stylex.defineConsts({
  topbar: 'var(--df-size-topbar)',
  controlSm: 'var(--df-size-control-sm)',
  controlMd: 'var(--df-size-control-md)',
  controlLg: 'var(--df-size-control-lg)'
})

export const motion = stylex.defineConsts({
  ease: 'var(--df-ease)',
  durHover: 'var(--df-dur-hover)',
  durState: 'var(--df-dur-state)',
  durCount: 'var(--df-dur-count)',
  cycle: 'var(--df-cycle)',
  beat: 'var(--df-beat)'
})

export const font = stylex.defineConsts({
  ui: 'var(--df-font-ui)',
  num: 'var(--df-font-num)'
})
