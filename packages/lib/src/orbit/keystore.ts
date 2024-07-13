import { generateKeyPair, importKey } from '@libp2p/crypto/keys'
import { createStorage } from 'unstorage'
import fsDriver, { type FSStorageOptions } from 'unstorage/drivers/fs'

import type { KeyStoreInstance } from '@orbitdb/core'

const password = 'password'

export function KeyStore(
  options?: FSStorageOptions,
): Promise<KeyStoreInstance> {
  const storage = createStorage<string>({
    driver: fsDriver(options),
  })

  return new Promise((resolve) =>
    resolve({
      async addKey(id, key) {
        const keyString = await key.export(password, 'libp2p-key')
        return storage.setItem(id, keyString)
      },
      clear() {
        return storage.clear()
      },
      close() {
        return storage.dispose()
      },
      async createKey() {
        return await generateKeyPair('secp256k1')
      },
      async removeKey(id: string) {
        await storage.removeItem(id)
      },
      async getKey(id) {
        const keyString = await storage.getItem(id)
        if (!keyString) {
          throw new Error('Key not found')
        }

        return await importKey<'secp256k1'>(keyString, password)
      },
      getPublic(keys) {
        const publicKey = keys.public.marshal()
        return publicKey.toString()
      },
      hasKey(id) {
        return storage.hasItem(id)
      },
    }),
  )
}
