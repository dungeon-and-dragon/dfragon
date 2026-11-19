import { useState } from 'react'

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
      className={`absolute inset-0 bg-canvas bg-cover bg-[center_30%]${fading ? ' transition-opacity duration-450 ease-standard starting:opacity-0 motion-reduce:transition-none' : ''}`}
      style={url !== undefined ? { backgroundImage: `url("${url}")` } : undefined}
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
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[image:linear-gradient(90deg,color-mix(in_srgb,var(--color-canvas)_94%,transparent)_0%,color-mix(in_srgb,var(--color-canvas)_72%,transparent)_42%,color-mix(in_srgb,var(--color-canvas)_45%,transparent)_100%),linear-gradient(180deg,transparent_55%,color-mix(in_srgb,var(--color-canvas)_90%,transparent)_100%)]"
      />
    </>
  )
}
