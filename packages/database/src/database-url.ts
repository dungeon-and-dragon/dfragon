import type { DatabaseConfiguration } from './configuration.js'

export function createDatabaseUrl(configuration: DatabaseConfiguration): string {
  const host = configuration.host.includes(':') ? `[${configuration.host}]` : configuration.host
  const username = encodeURIComponent(configuration.username)
  const password = encodeURIComponent(configuration.password)
  const database = encodeURIComponent(configuration.database)
  // URL의 hostname setter는 잘못된 값을 조용히 무시하므로 문자열 전체를 파싱해 잘못된 host를 거절한다.
  const url = URL.parse(
    `postgresql://${username}:${password}@${host}:${configuration.port}/${database}`
  )
  if (url === null || url.hostname.toLowerCase() !== host.toLowerCase()) {
    throw new Error('Invalid database configuration')
  }

  return url.href
}
