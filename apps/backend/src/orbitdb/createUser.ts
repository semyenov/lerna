import { KeyStore, LevelStorage } from '@orbitdb/core'
import { secp256k1ToJoseJWK } from '@regioni/lib/jose'
import { consola as logger } from 'consola'

const keysPath = './.out/keys'
const usersPath = './.out/users'
const keystore = await KeyStore({ path: keysPath })
const userStore = await LevelStorage({ path: usersPath })

const prompt = logger.prompt.bind(logger)
async function createUser() {
  const login = await prompt('Enter user login:', {
    type: 'text',
  })

  const keyPair = await keystore.createKey('userA')

  const privateJWK = await secp256k1ToJoseJWK(keyPair)
  userStore.put(login, JSON.stringify(privateJWK))
  logger.log(`User ${login} created successfully.`)
  // Add your user creation logic here
}

async function deleteUser() {
  const login = 12
  // const login = await prompt('Enter user login to delete:')
  const confirmation = await prompt(`Are you sure you want to delete user ${login}? (yes/no)`, {
    type: 'confirm',
  })
  logger.log(confirmation)

  if (confirmation) {
    logger.log(`User ${login} deleted successfully.`)

    return login
    // Add your user deletion logic here
  }
  else {
    logger.log('Deletion cancelled.')
  }
}

async function mainMenu() {
  while (true) {
    const res = await prompt('Test', {
      type: 'select',
      options: [
        { value: '1', label: 'Create user' },
        { value: '2', label: 'Delete user' },
        { value: '3', label: 'Exit' },
      ],
    }) as unknown as string

    switch (res) {
      case '1':
        await createUser()
        break
      case '2':
        await deleteUser()
        break
      case '3':
        logger.log('Exiting program. Goodbye!')

        return
      default:
        return
    }
  }
}

mainMenu()
