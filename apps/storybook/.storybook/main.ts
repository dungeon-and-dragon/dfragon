import type { StorybookConfig } from '@storybook/react-vite'
import { stylexOptions } from '@dfragon/ui/stylex-config'
import { unplugin as stylex } from '@stylexjs/unplugin'
import tailwindcss from '@tailwindcss/vite'
import { workspaceAliases } from '../../web/workspace-aliases.ts'

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: [
    '../src/**/*.stories.tsx',
    '../../../packages/ui/src/**/*.stories.tsx',
    '../../web/src/**/*.stories.tsx',
    '../../internal/src/**/*.stories.tsx'
  ],
  core: { disableTelemetry: true, disableWhatsNewNotifications: true },
  viteFinal(viteConfig) {
    // StyleX는 React plugin이 JSX를 바꾸기 전에 stylex.create를 읽어야 하므로 framework가 넣은 plugin보다 앞에 둔다.
    const plugins = [stylex.vite(stylexOptions), tailwindcss(), ...(viteConfig.plugins ?? [])]

    return {
      ...viteConfig,
      plugins,
      // 웹, 운영 화면 story는 두 앱과 같이 @dfragon/ui, @dfragon/lib을 source로 읽는다. 운영 앱 alias는 웹 alias 안에 있다.
      resolve: { ...viteConfig.resolve, alias: workspaceAliases, dedupe: ['react', 'react-dom'] },
      define: { ...viteConfig.define, __BUILD_COMMIT__: JSON.stringify('storybook') }
    }
  }
}

export default config
