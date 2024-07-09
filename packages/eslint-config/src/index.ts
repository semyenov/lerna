import { presetAll, sxzz } from '@sxzz/eslint-config'

const config = sxzz([
  ...presetAll,
  {
    rules: {
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
])

export default config
