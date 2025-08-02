import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';

const config: ForgeConfig = {
  packagerConfig: {
    icon: './build/icon',
    appBundleId: 'com.hashgraphonline.conversational-agent',
    appCategoryType: 'public.app-category.productivity',
    osxSign: {
      optionsForFile: (filePath) => {
        return {
          entitlements: 'build/entitlements.mac.plist'
        };
      }
    },
    osxNotarize: {
      appleId: process.env.APPLE_ID || '',
      appleIdPassword: process.env.APPLE_PASSWORD || '',
      teamId: process.env.APPLE_TEAM_ID || ''
    }
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'conversational_agent'
    }),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({
      options: {
        categories: ['Utility'],
        description: 'Desktop application for Conversational Agent'
      }
    }),
    new MakerDeb({
      options: {
        categories: ['Utility'],
        description: 'Desktop application for Conversational Agent'
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