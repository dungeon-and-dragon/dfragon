import type { StorybookConfig } from '@storybook/react-vite'
import tailwindcss from '@tailwindcss/vite'
import { workspaceAliases as internalAliases } from '../../internal/workspace-aliases.ts'
import { workspaceAliases as webAliases } from '../../web/workspace-aliases.ts'

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: [
    '../src/**/*.stories.tsx',
    '../../../packages/ui/src/**/*.stories.tsx',
    '../../web/src/**/*.stories.tsx',
    '../../internal/src/**/*.stories.tsx'
  ],
  addons: ['msw-storybook-addon'],
  // msw init이 만든 MSW service worker 파일을 story iframe과 같은 root 경로로 내준다.
  staticDirs: ['../public'],
  core: { disableTelemetry: true, disableWhatsNewNotifications: true },
  viteFinal(viteConfig) {
    const plugins = [tailwindcss(), ...(viteConfig.plugins ?? [])]
    const aliases = [...webAliases, ...internalAliases]

    return {
      ...viteConfig,
      plugins,
      // 웹, 운영 화면 story는 두 앱과 같이 @dfragon/ui, @dfragon/lib을 source로 읽는다.
      resolve: {
        ...viteConfig.resolve,
        alias: aliases,
        dedupe: ['react', 'react-dom']
      },
      define: { ...viteConfig.define, __BUILD_COMMIT__: JSON.stringify('storybook') }
    }
  }
}

export default config
