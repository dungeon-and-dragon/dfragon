import type { ReactNode } from 'react'
import { useScreenCapture } from '../hooks/useScreenCapture'
import { ScreenCaptureContext } from '../hooks/useScreenCaptureContext'
import { DESKTOP_CAPTURE_TEXTS, type CaptureTexts } from '@dfragon/client-core/lib/capture-texts'

export function ScreenCaptureProvider({
  texts = DESKTOP_CAPTURE_TEXTS,
  children
}: {
  texts?: CaptureTexts
  children: ReactNode
}): React.JSX.Element {
  const screenCapture = useScreenCapture(texts)

  return <ScreenCaptureContext value={screenCapture}>{children}</ScreenCaptureContext>
}
