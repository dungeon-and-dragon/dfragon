// jsdom에는 matchMedia가 없다. 전역 바의 모드 전환 버튼이 시스템 설정을 읽으므로, 어떤 media query도 맞지 않는
// 브라우저로 둔다. 시스템 설정을 바꿔 보는 테스트는 자기 matchMedia로 덮는다.
if (typeof window !== 'undefined' && window.matchMedia == null) {
  window.matchMedia = (query) =>
    Object.assign(new EventTarget(), {
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {}
    })
}
