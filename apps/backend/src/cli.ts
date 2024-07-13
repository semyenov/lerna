import { sign, verify } from '@regioni/lib/jose'
import { consola as logger } from 'consola'

import { ErrorUserKeyNotFound, ErrorUserNotFound } from './modules/users/errors'
import { type UserStoreInstance, UsersStore } from './modules/users/store'

const usersPath = './.out/users'
const prompt = logger.prompt.bind(logger)

async function createUser(userStore: UserStoreInstance) {
  const id = await prompt('Enter user id to create:', {
    type: 'text',
    initial: 'semyenov',
  })

  const user = await userStore.createUser(id, {
    id,
    hash: '',
    namespace: 'users',
    schemaId: 'user',
    version: '1',

    info: {
      name: `User ${id}`,
      description: 'user description',
      legend: `${id}@regioni.io`,
    },

    roles: ['admin'],
    status: 'active',

    createdAt: new Date(),
    updatedAt: new Date(),
  })

  logger.log('User created:', user)
}

async function deleteUser(userStore: UserStoreInstance) {
  const id = await prompt('Enter user id to delete:', {
    type: 'text',
    initial: 'semyenov',
  })

  const user = await userStore.getUser(id)
  if (!user) {
    throw ErrorUserNotFound
  }

  const confirmation = await prompt(
    `Are you sure you want to delete user ${id}? (yes/no)`,
    { type: 'confirm', initial: true },
  )

  if (!confirmation) {
    return
  }

  await userStore.removeUser(id)
}

async function getUser(userStore: UserStoreInstance) {
  const id = await prompt('Enter user id to get:', {
    type: 'text',
    initial: 'semyenov',
  })

  const user = await userStore.getUser(id)
  logger.info('getUser:', { user })
}

async function signData(userStore: UserStoreInstance) {
  const id = await prompt('Enter user id to sign:', {
    type: 'text',
    initial: 'semyenov',
  })

  const { user, jwk } = await userStore.getUser(id)
  if (!user) {
    throw ErrorUserNotFound
  } else if (!user.keys || !user.keys[0]) {
    throw ErrorUserKeyNotFound
  }

  const data = await prompt('Enter data:', {
    type: 'text',
    initial: '{"hello": "world"}',
  })

  const jwt = await sign(jwk, {
    data,
  })
  logger.info('signData:', { jwt })
}

async function verifyData(userStore: UserStoreInstance) {
  const data = await prompt('Enter data:', {
    type: 'text',
    initial: '{"hello": "world"}',
  })

  const keyset = await userStore.getKeyset()
  const { payload, protectedHeader, key } = await verify(data, keyset, {})

  logger.info('verifyData:', { payload, protectedHeader, key })
}

async function run() {
  const userStore = await UsersStore({ base: usersPath })

  while (true) {
    const res = (await prompt('Test', {
      type: 'select',
      options: [
        { value: '1', label: 'Create user' },
        { value: '2', label: 'Delete user' },
        { value: '3', label: 'Get user' },
        { value: '4', label: 'Sign data' },
        { value: '5', label: 'Verify data' },
        { value: '6', label: 'Exit' },
      ],
    })) as any as string

    switch (res) {
      case '1':
        await createUser(userStore)
        break
      case '2':
        await deleteUser(userStore)
        break
      case '3':
        await getUser(userStore)
        break
      case '4':
        await signData(userStore)
        break
      case '5':
        await verifyData(userStore)
        break
      default:
        logger.log('Exiting program. Goodbye!')
        return
    }
  }
}

run()
