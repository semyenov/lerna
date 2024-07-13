import { jwkToSecp256k1, secp256k1ToJWK } from '@regioni/lib/jose'
import { createLogger } from '@regioni/lib/logger'
import { KeyStore } from '@regioni/lib/orbit'
import { createStorage } from 'unstorage'
import fsDriver, { type FSStorageOptions } from 'unstorage/drivers/fs'

import type { User } from '../schema'
import type { JWK } from 'jose'

export interface UserStoreOptions {}

export interface UserStoreInstance {
  get: (id: string) => Promise<JWK | null>
  put: (id: string, value: User) => Promise<JWK>
  del: (id: string) => Promise<void>
  all: () => Promise<User[]>
}

const logger = createLogger({
  defaultMeta: { service: 'user-store' },
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
    if (!user || !user.keys) {
      throw new Error('User not found')
    }

    const keys = await keystore.getKey(user.keys[0])
    const jwk = await secp256k1ToJWK(keys)

    logger.info('JWKtosecp256k1', { jwk: jwkToSecp256k1(jwk) })
    logger.debug('get user success', { jwk })

    return jwk
  }

  const putUser = async (id: string, user: User) => {
    if (await storage.hasItem(id)) {
      throw new Error('User already exists')
    }

    const keys = await keystore.createKey(id)
    const kid = await keys.id()

    await keystore.addKey(kid, keys)
    await storage.setItem(id, { ...user, keys: [kid] })

    const jwk = await secp256k1ToJWK(keys)
    logger.debug('put user success', { jwk })

    return jwk
  }

  const deleteUser = async (id: string) => {
    const user = await storage.getItem(id)
    if (!user || !user.keys) {
      throw new Error('User not found')
    }

    await storage.removeItem(id)
    for (const kid of user.keys) {
      await keystore.removeKey(kid)
    }

    logger.debug('del user success', { user })
  }

  const getAllUsers = async () => {
    const users: User[] = []

    for (const id of await storage.getKeys()) {
      const user = await storage.getItem(id)
      if (user) {
        users.push(user)
      }
    }

    return users
  }

  return {
    get: getUser,
    put: putUser,
    del: deleteUser,
    all: getAllUsers,
  }
}
