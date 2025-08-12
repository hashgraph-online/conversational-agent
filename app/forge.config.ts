import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerPKG } from '@electron-forge/maker-pkg';
import { VitePlugin } from '@electron-forge/plugin-vite';

const config: ForgeConfig = {
  packagerConfig: {
    name: 'HOL Desktop',
    icon: './assets/hol-dock',
    appBundleId: 'com.hashgraphonline.conversational-agent',
    appCategoryType: 'public.app-category.productivity',
    extendInfo: {
      CFBundleName: 'HOL Desktop',
      CFBundleDisplayName: 'HOL Desktop',
      CFBundleShortVersionString: '1.0.0'
    },
    osxSign: {} // Empty object to skip code signing
  },
  rebuildConfig: {},
  makers: [
    // Squirrel has Wine issues on macOS ARM
    // new MakerSquirrel({
    //   name: 'conversational_agent',
    //   setupIcon: './assets/hol-app-icon-bubble.ico',
    //   authors: 'Hashgraph Online',
    //   description: 'Desktop application for HashgraphOnline'
    // }, ['win32']),
    new MakerZIP({}, ['darwin', 'win32']),
    new MakerRpm({
      options: {
        categories: ['Utility'],
        description: 'Desktop application for HashgraphOnline',
        icon: './assets/HOL-Icon.png'
      }
    }),
    new MakerDeb({
      options: {
        categories: ['Utility'],
        description: 'Desktop application for HashgraphOnline',
        icon: './assets/HOL-Icon.png'
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