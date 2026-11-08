export function buildCommit(sourceCommit: string | undefined): string {
  if (sourceCommit === undefined || sourceCommit === '') {
    return 'dev'
  }

  return sourceCommit.slice(0, 7)
}
