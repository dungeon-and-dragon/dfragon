import type { StorybookConfig } from '@storybook/react-vite'
import { stylexOptions } from '@dfragon/ui/stylex-config'
import { unplugin as stylex } from '@stylexjs/unplugin'
import tailwindcss from '@tailwindcss/vite'

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.stories.tsx', '../../../packages/ui/src/**/*.stories.tsx'],
  core: { disableTelemetry: true, disableWhatsNewNotifications: true },
  viteFinal(viteConfig) {
    // StyleX는 React plugin이 JSX를 바꾸기 전에 stylex.create를 읽어야 하므로 framework가 넣은 plugin보다 앞에 둔다.
    const plugins = [stylex.vite(stylexOptions), tailwindcss(), ...(viteConfig.plugins ?? [])]

    return {
      ...viteConfig,
      plugins,
      resolve: { ...viteConfig.resolve, dedupe: ['react', 'react-dom'] }
    }
  }
}

export default config
