import { serverNames } from '@dfragon/client-core/constants/servers'

export const serverOptions = Object.entries(serverNames).map(([id, label]) => ({ id, label }))
