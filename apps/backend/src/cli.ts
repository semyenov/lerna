import { consola as logger } from 'consola'

import { type UserStoreInstance, UsersStore } from './modules/users/lib/store'

const usersPath = './.out/users'
const prompt = logger.prompt.bind(logger)

async function createUser(userStore: UserStoreInstance) {
  const id = await prompt('Enter user id:', {
    type: 'text',
    initial: 'id',
  })

  const user = await userStore.put(id, {
    id,
    hash: '',
    namespace: 'users',
    schemaId: 'user',
    version: '1',

    info: {
      name: id,
      description: 'user description',
      legend: `${id}@regioni.io`,
    },

    roles: ['admin'],
    status: 'active',
    keys: [],

    createdAt: new Date(),
    updatedAt: new Date(),
  })

  logger.log('User created:', user)
}

async function deleteUser(userStore: UserStoreInstance) {
  const id = await prompt('Enter user id to delete:', {
    type: 'text',
  })

  const user = await userStore.get(id)

  if (!user) {
    logger.log(`User ${id} not found.`)
    return
  }

  const confirmation = await prompt(
    `Are you sure you want to delete user ${id}? (yes/no)`,
    {
      type: 'confirm',
    },
  )

  if (!confirmation) {
    return
  }

  await userStore.del(id)
}

async function run() {
  const userStore = await UsersStore({ base: usersPath })

  while (true) {
    const res = (await prompt('Test', {
      type: 'select',
      options: [
        { value: '1', label: 'Create user' },
        { value: '2', label: 'Delete user' },
        { value: '3', label: 'Exit' },
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
        logger.log('Exiting program. Goodbye!')

        return
      default:
        return
    }
  }
}

run()
