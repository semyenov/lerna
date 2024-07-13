import { consola as logger } from 'consola'

import { ErrorUserNotFound } from './modules/users/errors'
import { type UserStoreInstance, UsersStore } from './modules/users/store'

const usersPath = './.out/users'
const prompt = logger.prompt.bind(logger)

async function createUser(userStore: UserStoreInstance) {
  const id = await prompt('Enter user id:', {
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
  const id = await prompt('Enter user id:', {
    type: 'text',
    initial: 'semyenov',
  })

  const user = await userStore.getUser(id)
  logger.info('getUser:', { user })
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
        { value: '4', label: 'Exit' },
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
      default:
        logger.log('Exiting program. Goodbye!')
        return
    }
  }
}

run()
