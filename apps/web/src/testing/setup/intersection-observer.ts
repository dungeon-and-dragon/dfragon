// jsdom에는 IntersectionObserver가 없다. 스크롤해 화면 밖으로 나간 요소를 아는 화면이 있으므로, 아무 변화도 알리지 않는
// 관찰자로 둔다. 가시성이 바뀌는 경우를 보는 테스트는 자기 IntersectionObserver로 덮는다.
if (typeof window !== 'undefined' && window.IntersectionObserver == null) {
  window.IntersectionObserver = class {
    readonly root = null
    readonly rootMargin = '0px'
    readonly scrollMargin = '0px'
    readonly thresholds = [0]

    observe(): void {}

    unobserve(): void {}

    disconnect(): void {}

    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  }
}
