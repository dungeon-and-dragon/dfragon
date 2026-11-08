import { serverNames } from '#core/servers/servers'
import { ALL_CHARACTER_SERVERS } from '#core/api/character-schemas'

export const serverOptions = Object.entries(serverNames).map(([id, label]) => ({ id, label }))

export const characterSearchServerOptions = [
  { id: ALL_CHARACTER_SERVERS, label: '전체' },
  ...serverOptions
]
