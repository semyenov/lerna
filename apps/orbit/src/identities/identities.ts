/* eslint-disable no-unused-vars */
import {
  KeyStore,
  type KeyStoreInstance,
  signMessage,
  verifyMessage,
} from '../key-store.js'
import {
  ComposedStorage,
  IPFSBlockStorage,
  LRUStorage,
  type StorageInstance,
} from '../storage'
import { join } from '../utils'

import {
  Identity,
  type IdentityInstance,
  decodeIdentity,
  isEqual,
  isIdentity,
} from './identity.js'
import {
  type IdentityProvider,
  type IdentityProviderInstance,
  getIdentityProvider,
} from './providers'

import type { HeliaInstance } from '../vendor.js'

interface IdentitiesCreateIdentityOptions {
  id?: string
  provider?: ReturnType<IdentityProvider<string, IdentityProviderInstance>>
}
export interface IdentitiesOptions {
  path?: string

  ipfs?: HeliaInstance
  keystore?: KeyStoreInstance
  storage?: StorageInstance<Uint8Array>
}

export interface IdentitiesInstance {
  createIdentity: (
    options?: IdentitiesCreateIdentityOptions,
  ) => Promise<IdentityInstance>
  getIdentity: (id: string) => Promise<IdentityInstance | null>
  verifyIdentity: (identity: IdentityInstance) => Promise<boolean>
  keystore: KeyStoreInstance
  sign: (identity: IdentityInstance, data: string) => Promise<string>
  verify: (
    signature: string,
    publickey: string,
    data: string,
  ) => Promise<boolean>
}

const DEFAULT_KEYS_PATH = join('./orbitdb', 'identities')

export const Identities = async (
  { keystore, path, storage, ipfs }: IdentitiesOptions = {
    path: DEFAULT_KEYS_PATH,
  },
) => {
  /**
   * @namespace module:Identities~Identities
   * @description The instance returned by {@link module:Identities}.
   */

  const keys = keystore || (await KeyStore({ path: path || DEFAULT_KEYS_PATH }))

  const db: StorageInstance<Uint8Array> = storage
    ? storage
    : await ComposedStorage({
        storage1: await LRUStorage({ size: 1000 }),
        storage2: await IPFSBlockStorage({ ipfs, pin: true }),
      })

  const verifiedIdentitiesCache = await LRUStorage<IdentityInstance>({
    size: 1000,
  })

  const identities: IdentitiesInstance = {
    keystore: keys,

    createIdentity: async (options: IdentitiesCreateIdentityOptions = {}) => {
      const DefaultIdentityProvider = getIdentityProvider('publickey')
      const identityProviderInit =
        options.provider || DefaultIdentityProvider({ keystore: keys })

      const identityProvider: IdentityProviderInstance =
        await identityProviderInit()

      if (!getIdentityProvider(identityProvider.type)) {
        throw new Error(
          'Identity provider is unknown. Use useIdentityProvider(provider) to register the identity provider',
        )
      }

      const id = await identityProvider.getId({
        id: options.id!,
      })
      const privateKey = (await keys.getKey(id)) || (await keys.createKey(id))
      const publicKey = keys.getPublic(privateKey)
      const idSignature = await signMessage(privateKey, id)
      const publicKeyAndIdSignature = await identityProvider.signIdentity(
        publicKey + idSignature,
        { id: options.id! },
      )
      const signatures = {
        id: idSignature,
        publicKey: publicKeyAndIdSignature,
      }

      const identity = await Identity({
        id,
        publicKey,
        signatures,
        type: identityProvider.type,
        sign: async (data: string) => {
          const signingKey = await keys.getKey(id)

          if (!signingKey) {
            throw new Error('Private signing key not found from KeyStore')
          }

          return await signMessage(signingKey, data)
        },
        verify: async (signature: string, data: string) => {
          return await verifyMessage(signature, publicKey, data)
        },
      })

      await db.put(identity.hash, identity.bytes)

      return identity
    },
    verifyIdentity: async (identity) => {
      if (!isIdentity(identity)) {
        return false
      }

      const { id, publicKey, signatures } = identity
      const idSignatureVerified = await (async (signature, publicKey, data) => {
        return verifyMessage(signature, publicKey, data)
      })(signatures.id, publicKey, id)
      if (!idSignatureVerified) {
        return false
      }

      const verifiedIdentity = await verifiedIdentitiesCache.get(signatures.id)
      if (verifiedIdentity) {
        return isEqual(identity, verifiedIdentity)
      }

      const Provider = getIdentityProvider(identity.type)

      const identityVerified = await Provider.verifyIdentity(identity)
      if (identityVerified) {
        await verifiedIdentitiesCache.put(signatures.id, identity)
      }

      return identityVerified
    },
    getIdentity: async (hash) => {
      const bytes = await db.get(hash)
      if (bytes) {
        return decodeIdentity(bytes)
      }

      return null
    },
    sign: async (identity, data) => {
      const signingKey = await keys.getKey(identity.id)

      if (!signingKey) {
        throw new Error('Private signing key not found from KeyStore')
      }

      return await signMessage(signingKey, data)
    },
    verify: async (signature, publicKey, data) => {
      return await verifyMessage(signature, publicKey, data)
    },
  }

  return identities
}
