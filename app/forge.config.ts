import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { VitePlugin } from '@electron-forge/plugin-vite';

const config: ForgeConfig = {
  packagerConfig: {
    icon: './assets/hol-app-icon-bubble',
    appBundleId: 'com.hashgraphonline.conversational-agent',
    appCategoryType: 'public.app-category.productivity',
    osxSign: false,
    osxNotarize: false
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'conversational_agent',
      setupIcon: './assets/hol-app-bubble.png'
    }),
    new MakerZIP({}, ['darwin']),
    new MakerDMG({
      icon: './assets/hol-app-bubble.icns'
    }),
    new MakerRpm({
      options: {
        categories: ['Utility'],
        description: 'Desktop application for HashgraphOnline',
        icon: './assets/hol-app-bubble.png'
      }
    }),
    new MakerDeb({
      options: {
        categories: ['Utility'],
        description: 'Desktop application for HashgraphOnline',
        icon: './assets/hol-app-bubble.png'
      }
    })
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main'
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
          target: 'preload'
        }
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts'
        }
      ]
    })
  ]
};

export default config;