import { jwkToSecp256k1, secp256k1ToJWK, sign } from '@regioni/lib/jose'
import { createLogger } from '@regioni/lib/logger'
import { KeyStore } from '@regioni/lib/orbit'
import { createStorage } from 'unstorage'
import fsDriver, { type FSStorageOptions } from 'unstorage/drivers/fs'

import {
  ErrorUserExists,
  ErrorUserKeyNotFound,
  ErrorUserNotFound,
} from './errors'

import type { User } from './schema'
import type { KeyStoreInstance } from 'packages/orbitdb'

export interface UserStoreOptions {}

export interface UserStoreInstance {
  keystore: KeyStoreInstance
  storage: ReturnType<typeof createStorage>

  getUser: (id: string) => Promise<string>
  updateUser: (id: string, value: User) => Promise<string>
  createUser: (id: string, value: User) => Promise<string>
  removeUser: (id: string) => Promise<void>
}

const logger = createLogger({
  defaultMeta: {
    service: 'user-store',
    label: 'users',
  },
})

export async function UsersStore(
  options?: FSStorageOptions,
): Promise<UserStoreInstance> {
  const storage = createStorage<User>({
    driver: fsDriver({
      ...options,
      base: `${options?.base}/users` || './.out/users',
    }),
  })
  const keystore = await KeyStore({
    ...options,
    base: `${options?.base}/keys` || './.out/keys',
  })

  const getUser = async (id: string) => {
    const user = await storage.getItem(id)
    if (!user) {
      throw ErrorUserNotFound
    } else if (!user.keys || !user.keys[0]) {
      throw ErrorUserKeyNotFound
    }

    const keys = await keystore.getKey(user.keys[0])
    const jwk = await secp256k1ToJWK(keys)

    return sign(jwk, user)
  }

  const updateUser = async (id: string, user: User) => {
    const existingUser = await storage.getItem(id)
    if (!existingUser) {
      throw ErrorUserNotFound
    } else if (!existingUser.keys || !existingUser.keys[0]) {
      throw ErrorUserKeyNotFound
    }

    const keys = await keystore.getKey(existingUser.keys[0] || 'unknown')
    const jwk = await secp256k1ToJWK(keys)

    await storage.setItem(id, {
      ...user,
      keys: existingUser.keys.concat(user.keys || []),
    })

    return sign(jwk, user)
  }

  const createUser = async (id: string, user: User) => {
    if (await storage.hasItem(id)) {
      throw ErrorUserExists
    }

    const keys = await keystore.createKey(id)
    const kid = await keys.id()

    await keystore.addKey(kid, keys)
    await storage.setItem(id, { ...user, keys: [kid] })

    const jwk = await secp256k1ToJWK(keys)

    logger.info('User created', { user })
    logger.debug('User jwk', { jwk })

    return sign(jwk, user)
  }

  const removeUser = async (id: string) => {
    const user = await storage.getItem(id)
    if (!user) {
      throw ErrorUserNotFound
    } else if (!user.keys || !user.keys[0]) {
      throw ErrorUserKeyNotFound
    }

    await storage.removeItem(id)
    logger.debug('User deleted', { user })

    for (const kid of user.keys) {
      await keystore.removeKey(kid)
      logger.debug('User deleted with key', { kid })
    }
  }

  return {
    keystore,
    storage,

    getUser,
    createUser,
    updateUser,
    removeUser,
  }
}
