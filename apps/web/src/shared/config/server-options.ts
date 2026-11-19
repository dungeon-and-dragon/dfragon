import { serverNames } from './servers'

export const ALL_CHARACTER_SERVERS = 'all'

export const serverOptions = Object.entries(serverNames).map(([id, label]) => ({ id, label }))

export const characterSearchServerOptions = [
  { id: ALL_CHARACTER_SERVERS, label: '전체' },
  ...serverOptions
]
