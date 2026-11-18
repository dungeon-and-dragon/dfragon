import type { StorybookConfig } from '@storybook/react-vite'
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
    const plugins = [tailwindcss(), ...(viteConfig.plugins ?? [])]

    return {
      ...viteConfig,
      plugins,
      resolve: { ...viteConfig.resolve, alias: workspaceAliases, dedupe: ['react', 'react-dom'] },
      define: { ...viteConfig.define, __BUILD_COMMIT__: JSON.stringify('storybook') }
    }
  }
}

export default config
