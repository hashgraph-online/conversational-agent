import sonarjs from 'eslint-plugin-sonarjs';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

const reactHooksStub = {
  rules: {
    'exhaustive-deps': {
      meta: { type: 'problem' },
      create: () => ({}),
    },
  },
};

const eslintConfig = [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '*.d.ts',
      '**/*.d.ts',
      '.yalc/**',
      'cli/.yalc/**',
      '**/.yalc/**',
      'cli/**',
      'yalc.lock',
      'examples/**',
      'vite.config.ts',
    ],
  },
  // Root package source
  {
    files: ['src/**/*.{ts,tsx}', '__tests__/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { modules: true },
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      sonarjs,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        { allowExpressions: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-unneeded-ternary': ['error', { defaultAssignment: false }],
      'no-nested-ternary': 'error',
      'no-constant-binary-expression': 'error',
      complexity: ['warn', { max: 100 }],
      'max-lines-per-function': [
        'warn',
        { max: 1000, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      'no-unused-vars': 'off',
      'sonarjs/no-duplicate-string': 'warn',
      'sonarjs/no-identical-functions': 'warn',
    },
  },
  // Electron app subtree uses its own tsconfig
  {
    files: ['app/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { modules: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      sonarjs,
      'react-hooks': reactHooksStub,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        { allowExpressions: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-unneeded-ternary': ['error', { defaultAssignment: false }],
      'no-nested-ternary': 'warn',
      'no-constant-binary-expression': 'error',
      'react-hooks/exhaustive-deps': 'off',
      complexity: ['warn', { max: 100 }],
      'max-lines-per-function': [
        'warn',
        { max: 1000, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      'no-unused-vars': 'off',
      'sonarjs/no-duplicate-string': 'warn',
      'sonarjs/no-identical-functions': 'warn',
    },
  },
];

export default eslintConfig;
