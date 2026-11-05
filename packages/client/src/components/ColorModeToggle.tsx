import { IconButton } from '@dfragon/ui'
import { useSyncExternalStore } from 'react'
import { type ColorMode, useColorModeStore } from '../hooks/useColorModeStore'
import { MoonIcon } from './MoonIcon'
import { SunIcon } from './SunIcon'

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)'
const THEME_COLOR_META_SELECTOR = 'meta[name="theme-color"][data-color-mode]'

const SWITCH_LABELS: Record<ColorMode, string> = {
  light: '라이트 모드로 바꾸기',
  dark: '다크 모드로 바꾸기'
}

function subscribeSystemColorMode(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_SCHEME_QUERY)
  query.addEventListener('change', onChange)

  return () => query.removeEventListener('change', onChange)
}

function readSystemColorMode(): ColorMode {
  if (window.matchMedia(DARK_SCHEME_QUERY).matches) {
    return 'dark'
  }

  return 'light'
}

// apps/web/index.html의 첫 그리기 전 script도 저장된 모드를 같은 방식으로 붙인다. 고른 모드가 없으면 tokens.css와
// theme-color meta의 media가 시스템 설정을 따른다.
function applyColorMode(colorMode: ColorMode): void {
  document.documentElement.dataset.colorMode = colorMode
  for (const meta of document.querySelectorAll<HTMLMetaElement>(THEME_COLOR_META_SELECTOR)) {
    meta.media = meta.dataset.colorMode === colorMode ? 'all' : 'not all'
  }
}

export function ColorModeToggle(): React.JSX.Element {
  const chosenColorMode = useColorModeStore((state) => state.colorMode)
  const changeColorMode = useColorModeStore((state) => state.changeColorMode)
  const systemColorMode = useSyncExternalStore(subscribeSystemColorMode, readSystemColorMode)
  const colorMode = chosenColorMode ?? systemColorMode
  const nextColorMode = colorMode === 'dark' ? 'light' : 'dark'
  const handleClick = () => {
    applyColorMode(nextColorMode)
    changeColorMode(nextColorMode)
  }

  return (
    <IconButton
      size="bar"
      aria-label={SWITCH_LABELS[nextColorMode]}
      icon={nextColorMode === 'light' ? <SunIcon /> : <MoonIcon />}
      onClick={handleClick}
    />
  )
}
