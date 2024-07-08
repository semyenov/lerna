import * as antfu from '@antfu/eslint-config'

const config = antfu.antfu({
  rules: {
    'antfu/if-newline': ['error'],
    'antfu/generic-spacing': ['error'],
    'style/max-statements-per-line': ['off'],
    'style/array-bracket-newline': ['error', { multiline: true }],
    'eol-last': ['error', 'always'],

    'import/order': [
      'error',
      {
        'newlines-between': 'always',
        'distinctGroup': true,

        'groups': [
          'builtin',
          'external',
          'object',
          'parent',
          'internal',
          'sibling',
          'index',
          'type',
        ],

        'pathGroups': [
          {
            pattern: '@/**',
            group: 'internal',
            position: 'after',
          },
          {
            pattern: '~/**',
            group: 'internal',
            position: 'after',
          },
        ],

        'alphabetize': {
          order: 'asc',
          orderImportKind: 'asc',
          caseInsensitive: false,
        },
      },
    ],
  },
})

export type { ConfigItem } from '@antfu/eslint-config'
export default config
