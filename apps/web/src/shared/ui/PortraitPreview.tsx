import { Tooltip } from '@dfragon/ui'
import { type ReactElement, useState } from 'react'

// 확대 창이 열린 뒤 이미지를 못 받아 바로 닫히면 깜빡이므로, 썸네일 이미지가 뜬 뒤에만 연다.
// img의 load는 버블링되지 않지만 React가 부모의 onLoad까지 전달한다.
export function PortraitPreview({
  src,
  children
}: {
  src: string
  children: ReactElement
}): React.JSX.Element {
  const [loadedSource, setLoadedSource] = useState<string>()
  const handleLoad = () => setLoadedSource(src)

  return (
    // 확대 그림이 옆 행을 덮으므로, 마우스가 썸네일을 벗어나면 확대 그림 위에 있어도 닫는다.
    <Tooltip.Root disabled={loadedSource !== src} disableHoverablePopup>
      <Tooltip.Trigger delay={0} closeDelay={0} render={children} onLoad={handleLoad} />
      <Tooltip.Popup side="right">
        <img src={src} alt="" draggable={false} className="tooltip-portrait" />
      </Tooltip.Popup>
    </Tooltip.Root>
  )
}
