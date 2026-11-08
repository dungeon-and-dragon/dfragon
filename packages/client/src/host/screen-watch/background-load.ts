// 템플릿을 아직 받지 못했으면 null을 돌려주고 받기 시작한다. 실패하면 loader가 캐시를 비우므로 다음 호출이 다시 받는다.
export function createBackgroundLoad<T>(load: () => Promise<T>): () => T | null {
  let value: T | null = null
  let loading = false

  return () => {
    if (value === null && !loading) {
      loading = true
      load()
        .then(
          (loaded) => {
            value = loaded
          },
          () => undefined
        )
        .finally(() => {
          loading = false
        })
    }

    return value
  }
}
