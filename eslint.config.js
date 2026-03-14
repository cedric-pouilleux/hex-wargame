import js from '@eslint/js'
import importPlugin from 'eslint-plugin-import'

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    plugins: {
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.app.json',
        },
        node: {
          extensions: ['.ts', '.js'],
        },
      },
    },
    rules: {
      'import/no-restricted-paths': ['error', {
        zones: [
          { target: './src/simulation', from: './src/ui' },
          { target: './src/simulation', from: './src/renderer' },
          { target: './src/renderer',   from: './src/ui' },
        ],
      }],
    },
  },
]
