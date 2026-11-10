import type { JobRunErrorEntry } from '@dfragon/database'
import { formatDuration, intervalToDuration } from 'date-fns'
import { ko } from 'date-fns/locale'
import ky from 'ky'
import type { JobAlert, SendJobAlert } from '../../application/jobs/ports.js'

const KIND_LABELS = { failed: '실패', interrupted: '중단', delayed: '지연' } as const

function formatErrorEntry({ name, code }: JobRunErrorEntry): string {
  if (code === undefined) {
    return name
  }

  return `${name}(${code})`
}

// 오류 message와 인자는 입력값이나 credential을 담을 수 있어 name과 code만 보낸다.
function formatJobAlert({ kind, job, trigger, elapsedMs, errorChain = [] }: JobAlert): string {
  const elapsed =
    formatDuration(intervalToDuration({ start: 0, end: elapsedMs }), { locale: ko }) || '1초 미만'
  const lines = [`[${KIND_LABELS[kind]}] ${job}`, `계기: ${trigger}`, `경과: ${elapsed}`]
  if (errorChain.length > 0) {
    lines.push(`오류: ${errorChain.map(formatErrorEntry).join(' ← ')}`)
  }

  return lines.join('\n')
}

export function createDiscordJobAlert(
  webhookUrl: string,
  fetch?: typeof globalThis.fetch
): SendJobAlert {
  const discord = ky.create({ fetch, timeout: 10_000, retry: { limit: 2, methods: ['post'] } })

  return async (alert) => {
    await discord.post(webhookUrl, {
      json: { content: formatJobAlert(alert), allowed_mentions: { parse: [] } }
    })
  }
}
