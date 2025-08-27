import { resolve } from 'path';
import { defineConfig, type UserConfig } from 'vite';
import dts from 'vite-plugin-dts';
import type { LibraryFormats } from 'vite';

type BuildFormat = LibraryFormats;

interface GlobalMap {
  [key: string]: string;
}

const EXTERNAL_DEPENDENCIES = [
  '@hashgraphonline/standards-agent-kit',
  'hedera-agent-kit',
  '@hashgraphonline/standards-sdk',
  '@langchain/core',
  'zod',
];

const GLOBAL_MAP: GlobalMap = {
  '@hashgraphonline/standards-agent-kit': 'StandardsAgentKit',
  'hedera-agent-kit': 'HederaAgentKit',
  '@hashgraphonline/standards-sdk': 'StandardsSDK',
  '@langchain/core': 'LangchainCore',
  zod: 'Zod',
};

function getOutputDirectory(format: BuildFormat): string {
  if (format === 'umd') {
    return 'dist/umd';
  }
  if (format === 'cjs') {
    return 'dist/cjs';
  }
  return 'dist/esm';
}

function getTypesOutputDirectory(
  format: BuildFormat,
  outputDir: string
): string {
  if (format === 'es') {
    return 'dist/types';
  }
  return outputDir;
}

function getFileName(format: BuildFormat): (fmt: string) => string {
  return (fmt: string) => {
    if (format === 'umd') {
      return `conversational-agent.${fmt}.js`;
    }
    if (format === 'cjs') {
      return 'index.cjs';
    }
    return 'index.js';
  };
}

function isExternalDependency(id: string, format: BuildFormat): boolean {
  if (format === 'umd') {
    return EXTERNAL_DEPENDENCIES.some(
      (dep) => id === dep || id.startsWith(`${dep}/`)
    );
  }

  const isExternalPackage = EXTERNAL_DEPENDENCIES.some(
    (dep) => id === dep || id.startsWith(`${dep}/`)
  );

  const isRelativeImport =
    !id.startsWith('.') && !id.startsWith('/') && !id.includes(__dirname);

  return isExternalPackage || isRelativeImport;
}

function getGlobalName(id: string): string {
  return GLOBAL_MAP[id] || id;
}

function createRollupOutput(format: BuildFormat) {
  if (format === 'cjs') {
    return {
      exports: 'named' as const,
      format: 'cjs' as const,
    };
  }

  const output: any = {
    globals: getGlobalName,
    preserveModules: format === 'es',
    exports: 'named' as const,
    inlineDynamicImports: format === 'umd',
  };
  
  if (format === 'es') {
    output.preserveModulesRoot = 'src';
  }
  
  if (format === 'umd') {
    output.name = 'ConversationalAgent';
  }
  
  return output;
}

export default defineConfig(async (): Promise<UserConfig> => {
  const format = (process.env.BUILD_FORMAT || 'es') as BuildFormat;
  const outputDir = getOutputDirectory(format);

  const plugins = [
    dts({
      insertTypesEntry: true,
      include: ['src/**/*.ts'],
      exclude: ['**/*.d.ts', 'tests/**/*', 'vite.config.ts', 'src/examples/**/*', 'src/scripts/**/*'],
      outDir: getTypesOutputDirectory(format, outputDir),
    }),
  ];

  if (format === 'umd') {
    const { nodePolyfills } = await import('vite-plugin-node-polyfills');
    plugins.push(
      nodePolyfills({
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
        protocolImports: true,
      })
    );
  }

  const defineConfig: Record<string, string> = {
    VITE_BUILD_FORMAT: JSON.stringify(format),
  };

  if (format === 'cjs') {
    defineConfig.Buffer = 'globalThis.Buffer';
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        util: 'util',
      },
    },
    build: {
      outDir: outputDir,
      lib: format === 'umd' ? {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'ConversationalAgent',
        fileName: getFileName(format),
        formats: [format],
      } : {
        entry: resolve(__dirname, 'src/index.ts'),
        fileName: getFileName(format),
        formats: [format],
      },
      rollupOptions: {
        external: (id: string) => isExternalDependency(id, format),
        output: createRollupOutput(format),
      },
      minify: 'terser' as const,
      sourcemap: true,
      target: 'es2020',
    },
    define: defineConfig,
    ssr: {
      noExternal: [],
      external: EXTERNAL_DEPENDENCIES,
    },
  };
});