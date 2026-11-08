const AWAKENING_PREFIX = /^眞\s*/u

export function formatJobName(jobName: string): string {
  const name = jobName.replace(AWAKENING_PREFIX, '')
  if (name === '') {
    return jobName
  }

  return name
}
