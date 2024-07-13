import { presetAll, sxzz } from '@sxzz/eslint-config'
import pluginSecurity from 'eslint-plugin-security'
import sonarjs from 'eslint-plugin-sonarjs'

import type { Linter } from 'eslint'
const config = sxzz(
  [
    pluginSecurity.configs.recommended,
    ...presetAll,
    sonarjs.configs.recommended as Linter.FlatConfig,
    {
      rules: {
        'eslint-comments/no-unlimited-disable': 'off',
        'no-duplicate-imports': 'off',
        'import/order': [
          'error',
          {
            'newlines-between': 'always',
            distinctGroup: true,

            groups: [
              'builtin',
              'external',
              'object',
              'parent',
              'internal',
              'sibling',
              'index',
              'type',
            ],

            pathGroups: [
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

            alphabetize: {
              order: 'asc',
              orderImportKind: 'asc',
              caseInsensitive: false,
            },
          },
        ],
      },
    },
  ],
  {
    prettier: true,
    sortKeys: true,
    command: true,
  },
)

export default config
