import * as stylex from '@stylexjs/stylex'
import { useState } from 'react'
import { styles } from './SeasonBackdrop.style'

type Backdrop = Readonly<{ url: string | undefined; previous: string | undefined; fading: boolean }>

function BackdropLayer({
  url,
  fading
}: {
  url: string | undefined
  fading: boolean
}): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      {...stylex.props(
        styles.backdrop,
        url !== undefined && styles.backdropImage(url),
        fading && styles.fading
      )}
    />
  )
}

export function SeasonBackdrop({ url }: { url: string | undefined }): React.JSX.Element {
  const [backdrop, setBackdrop] = useState<Backdrop>({ url, previous: undefined, fading: false })
  if (backdrop.url !== url) {
    setBackdrop({ url, previous: backdrop.url, fading: true })
  }

  return (
    <>
      {backdrop.fading && <BackdropLayer url={backdrop.previous} fading={false} />}
      <BackdropLayer key={backdrop.url ?? ''} url={backdrop.url} fading={backdrop.fading} />
      <div aria-hidden="true" {...stylex.props(styles.shade)} />
    </>
  )
}
