import { serverNames } from '@dfragon/client-core/constants/servers'
import { ALL_CHARACTER_SERVERS } from '@dfragon/client-core/shared/search/character-http'

export const serverOptions = Object.entries(serverNames).map(([id, label]) => ({ id, label }))

export const characterSearchServerOptions = [
  { id: ALL_CHARACTER_SERVERS, label: '전체' },
  ...serverOptions
]
