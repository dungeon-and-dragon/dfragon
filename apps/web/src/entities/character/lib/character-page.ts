export type CharacterPage = 'detail' | 'simulator'

export const CHARACTER_PAGE_PATHS = {
  detail: '/c/$serverId/$characterId',
  simulator: '/c/$serverId/$characterId/simulator'
} as const satisfies Record<CharacterPage, string>
