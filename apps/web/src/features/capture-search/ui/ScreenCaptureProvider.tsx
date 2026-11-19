import type { ReactNode } from 'react'
import type { CaptureTexts } from '#features/capture-search/lib/capture/capture-texts'
import { useScreenCapture } from '#features/capture-search/model/useScreenCapture'
import { ScreenCaptureContext } from '#features/capture-search/model/useScreenCaptureContext'

export function ScreenCaptureProvider({
  texts,
  children
}: {
  texts: CaptureTexts
  children: ReactNode
}): React.JSX.Element {
  const screenCapture = useScreenCapture(texts)

  return <ScreenCaptureContext value={screenCapture}>{children}</ScreenCaptureContext>
}
